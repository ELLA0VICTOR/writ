use crate::model::*;
use crate::{Contract, ContractExt};
use near_sdk::serde_json::{Value, json};
use near_sdk::{AccountId, Gas, NearToken, Promise, env, near, require};

#[near]
impl Contract {
    pub fn get_retired_writs(&self, owner_id: AccountId) -> Value {
        json!(
            self.tokens
                .values()
                .filter(|t| t.state == State::Retired && t.executor_ready && t.owner == owner_id)
                .map(|t| json!({"id":t.id,"executor":t.executor,"target":t.target}))
                .collect::<Vec<_>>()
        )
    }
    pub fn withdraw_retired_funds(
        &mut self,
        token_id: String,
        amount: near_sdk::json_types::U128,
    ) -> Promise {
        let mut t = self
            .tokens
            .get(&token_id)
            .cloned()
            .expect("Unknown retired Writ");
        require!(
            t.state == State::Retired
                && t.executor_ready
                && t.owner == env::predecessor_account_id()
                && t.pending == 0,
            "Retired beneficiary only"
        );
        require!(amount.0 > 0, "Positive amount required");
        t.pending = 1;
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        let receiver = t.owner.clone();
        let executor = t.executor.clone();
        self.tokens.insert(token_id.clone(), t);
        Promise::new(executor).function_call("withdraw",json!({"receiver_id":receiver,"amount":amount}).to_string().into_bytes(),NearToken::from_yoctonear(0),Gas::from_tgas(20))
          .then(Self::callback("on_operation",json!({"token_id":token_id,"operation_id":op,"kind":"retired-withdraw","refund_to":receiver,"refund":near_sdk::json_types::U128(0)}),30))
    }
    pub fn nft_metadata(&self) -> Value {
        json!({"spec":"nft-1.0.0","name":"Writ","symbol":"WRIT","icon":null,"base_uri":null,"reference":null,"reference_hash":null})
    }
    pub fn nft_token(&self, token_id: String) -> Value {
        self.tokens
            .get(&token_id)
            .filter(|t| t.state != State::Creating && t.state != State::Retired)
            .map(Self::nft_view)
            .unwrap_or(Value::Null)
    }
    pub fn nft_total_supply(&self) -> String {
        self.tokens
            .values()
            .filter(|t| t.state != State::Creating && t.state != State::Retired)
            .count()
            .to_string()
    }
    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> String {
        self.tokens
            .values()
            .filter(|t| {
                t.state != State::Creating && t.state != State::Retired && t.owner == account_id
            })
            .count()
            .to_string()
    }
    pub fn nft_tokens(&self, from_index: Option<String>, limit: Option<u32>) -> Vec<Value> {
        self.enumerate(None, from_index, limit)
    }
    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<String>,
        limit: Option<u32>,
    ) -> Vec<Value> {
        self.enumerate(Some(account_id), from_index, limit)
    }

    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        near_sdk::assert_one_yocto();
        require!(approval_id.is_none(), "Approvals are not supported");
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        let previous = t.owner.clone();
        self.move_token(
            &mut t,
            receiver_id,
            memo.as_deref().unwrap_or("Direct transfer"),
        );
        Self::nft_event(
            "nft_transfer",
            json!({"old_owner_id":previous,"new_owner_id":t.owner,"token_ids":[t.id],"memo":memo}),
        );
        self.tokens.insert(token_id, t);
    }
    #[payable]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> Promise {
        near_sdk::assert_one_yocto();
        require!(approval_id.is_none(), "Approvals are not supported");
        require!(msg.len() <= 4096, "Receiver message too large");
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        let previous = t.owner.clone();
        self.move_token(&mut t, receiver_id.clone(), "Receiver transfer started");
        let operation = self.op();
        t.state = State::ReceiverLocked;
        t.lock = Some(operation.to_string());
        self.tokens.insert(token_id.clone(), t);
        Self::nft_event(
            "nft_transfer",
            json!({"old_owner_id":previous,"new_owner_id":receiver_id,"token_ids":[token_id],"memo":memo}),
        );
        Promise::new(receiver_id.clone()).function_call("nft_on_transfer",json!({"sender_id":previous,"previous_owner_id":previous,"token_id":token_id,"msg":msg}).to_string().into_bytes(),NearToken::from_yoctonear(0),Gas::from_tgas(30))
            .then(Self::callback("nft_resolve_transfer",json!({"previous_owner_id":previous,"receiver_id":receiver_id,"token_id":token_id,"operation_id":operation}),30))
    }
    #[private]
    pub fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: String,
        operation_id: u64,
    ) -> bool {
        let Some(mut t) = self.tokens.get(&token_id).cloned() else {
            return true;
        };
        if t.state != State::ReceiverLocked
            || t.lock.as_deref() != Some(&operation_id.to_string())
            || t.owner != receiver_id
        {
            return true;
        }
        let give_back = Self::response(0).and_then(|v| v.as_bool()).unwrap_or(true);
        t.state = State::Idle;
        t.lock = None;
        if give_back {
            self.move_token(
                &mut t,
                previous_owner_id.clone(),
                "Receiver declined or failed",
            );
            Self::nft_event(
                "nft_transfer",
                json!({"old_owner_id":receiver_id,"new_owner_id":previous_owner_id,"token_ids":[token_id],"memo":"Receiver rollback"}),
            );
        }
        self.tokens.insert(token_id, t);
        !give_back
    }

    pub fn begin_unwrap(&mut self, token_id: String) -> Promise {
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        require!(
            Self::template(&t.template_id).supports_unwrap && t.template_id == "contract-owner",
            "No hand-back recipe"
        );
        t.loans
            .retain(|l| l.expires_at_ms > env::block_timestamp_ms());
        require!(t.loans.is_empty(), "End loans first");
        t.state = State::Unwrapping;
        t.pending = 1;
        t.nonce += 1;
        let owner = t.owner.clone();
        let executor = t.executor.clone();
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        self.tokens.insert(token_id.clone(), t);
        Self::forward(
            executor,
            "own_propose_owner".into(),
            json!({"account_id":owner}),
        )
        .then(Self::callback(
            "on_unwrap_proposal",
            json!({"token_id":token_id,"operation_id":op}),
            30,
        ))
    }
    #[private]
    pub fn on_unwrap_proposal(&mut self, token_id: String, operation_id: u64) -> bool {
        if self.operations.remove(&operation_id).as_ref() != Some(&token_id) {
            return false;
        }
        let Some(mut t) = self.tokens.get(&token_id).cloned() else {
            return false;
        };
        if t.state != State::Unwrapping || t.pending != 1 {
            return false;
        }
        t.pending = 0;
        let ok = Self::response(0).and_then(|v| v.as_bool()).unwrap_or(false);
        if !ok {
            t.state = State::Idle;
        }
        Self::record(
            &mut t,
            if ok {
                "Hand-back proposed"
            } else {
                "Hand-back proposal failed"
            },
            "Holder must accept the external role",
            !ok,
        );
        self.tokens.insert(token_id, t);
        ok
    }
    pub fn finish_unwrap(&mut self, token_id: String) -> Promise {
        let mut t = self.owned(&token_id);
        require!(
            (t.state == State::Unwrapping || t.state == State::Idle)
                && t.pending == 0
                && t.template_id == "contract-owner",
            "Hand-back cannot be checked now"
        );
        t.state = State::Unwrapping;
        t.pending = 1;
        let target = t.target.clone();
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        self.tokens.insert(token_id.clone(), t);
        Promise::new(target.clone())
            .function_call(
                "own_get_owner",
                b"{}".to_vec(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(10),
            )
            .and(Promise::new(target).function_call(
                "own_get_proposed_owner",
                b"{}".to_vec(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(10),
            ))
            .then(Self::callback(
                "on_unwrap_checks",
                json!({"token_id":token_id,"operation_id":op}),
                40,
            ))
    }
    #[private]
    pub fn on_unwrap_checks(&mut self, token_id: String, operation_id: u64) -> bool {
        if self.operations.remove(&operation_id).as_ref() != Some(&token_id) {
            return false;
        }
        let Some(mut t) = self.tokens.get(&token_id).cloned() else {
            return false;
        };
        if t.state != State::Unwrapping || t.pending != 1 {
            return false;
        }
        t.pending = 0;
        let passed =
            Self::response(0) == Some(json!(t.owner)) && Self::response(1) == Some(Value::Null);
        if passed {
            t.state = State::Retired;
            t.epoch += 1;
            t.nonce += 1;
            Self::record(
                &mut t,
                "Role unwrapped",
                "External owner verified before NFT retirement",
                false,
            );
            Self::nft_event(
                "nft_burn",
                json!({"owner_id":t.owner,"token_ids":[token_id]}),
            );
        } else {
            Self::record(
                &mut t,
                "Hand-back not confirmed",
                "Accept the proposed role then retry",
                true,
            );
        }
        self.tokens.insert(token_id, t);
        passed
    }
    pub fn cancel_unwrap(&mut self, token_id: String) -> Promise {
        let mut t = self.owned(&token_id);
        require!(
            t.state == State::Unwrapping && t.pending == 0,
            "No cancellable hand-back"
        );
        t.pending = 1;
        let executor = t.executor.clone();
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        self.tokens.insert(token_id.clone(), t);
        Self::forward(
            executor,
            "own_propose_owner".into(),
            json!({"account_id":null}),
        )
        .then(Self::callback(
            "on_unwrap_cancel",
            json!({"token_id":token_id,"operation_id":op}),
            30,
        ))
    }
    #[private]
    pub fn on_unwrap_cancel(&mut self, token_id: String, operation_id: u64) -> bool {
        if self.operations.remove(&operation_id).as_ref() != Some(&token_id) {
            return false;
        }
        let Some(mut t) = self.tokens.get(&token_id).cloned() else {
            return false;
        };
        if t.state != State::Unwrapping || t.pending != 1 {
            return false;
        }
        t.pending = 0;
        let ok = Self::response(0).and_then(|v| v.as_bool()).unwrap_or(false);
        if ok {
            t.state = State::Idle;
            t.nonce += 1;
        }
        self.tokens.insert(token_id, t);
        ok
    }
}
impl Contract {
    fn move_token(&mut self, t: &mut Token, receiver: AccountId, memo: &str) {
        require!(receiver != t.owner, "Receiver already holds Writ");
        require!(
            receiver != env::current_account_id(),
            "Collection cannot hold its own role NFT"
        );
        t.owner = receiver;
        t.epoch += 1;
        t.nonce += 1;
        t.loans.clear();
        Self::record(t, "NFT transferred", memo, false);
    }
    fn enumerate(
        &self,
        owner: Option<AccountId>,
        from: Option<String>,
        limit: Option<u32>,
    ) -> Vec<Value> {
        let start = from.and_then(|v| v.parse::<usize>().ok()).unwrap_or(0);
        self.tokens
            .values()
            .filter(|t| {
                t.state != State::Creating
                    && t.state != State::Retired
                    && owner.as_ref().is_none_or(|id| id == &t.owner)
            })
            .skip(start)
            .take(limit.unwrap_or(20).min(50) as usize)
            .map(Self::nft_view)
            .collect()
    }
    fn nft_view(t: &Token) -> Value {
        use near_sdk::base64::{Engine, engine::general_purpose::STANDARD};
        let title = if t.template_id == "dao-council" {
            "Council seat"
        } else {
            "Contract owner"
        };
        let svg = crate::media::render(t);
        json!({"token_id":t.id,"owner_id":t.owner,"metadata":{"title":format!("Writ {} — {title}",t.id),"description":"The current NFT holder controls a keyless executor. External role conditions must be inspected separately.","media":format!("data:image/svg+xml;base64,{}",STANDARD.encode(svg)),"copies":1,"extra":json!({"executor":t.executor,"target":t.target,"epoch":t.epoch.to_string(),"nonce":t.nonce.to_string(),"template_hash":t.template_hash}).to_string()}})
    }
}
