mod media;
mod model;
mod nft;
mod practice;
use model::*;
use near_sdk::json_types::U128;
use near_sdk::serde_json::{Value, json};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{AccountId, Gas, NearToken, PanicOnDefault, Promise, env, near, require};

const EXECUTOR: &[u8] = include_bytes!("../../../artifacts/executor.wasm");
const OWNER: &str = include_str!("../../../src/templates/contract-owner.json");
const DAO: &str = include_str!("../../../src/templates/dao-council.json");
const STORAGE_FEE: u128 = 50_000_000_000_000_000_000_000;
const MINT_STORAGE_BYTES: u128 = 131_072;
const DEADLINE: u64 = 200;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: IterableMap<String, Token>,
    purchases: LookupMap<String, Purchase>,
    credits: LookupMap<AccountId, u128>,
    withdrawals: LookupMap<u64, CreditTransfer>,
    mint_requests: LookupMap<String, String>,
    operations: LookupMap<u64, String>,
    practice_requests: LookupMap<String, Practice>,
    next_id: u64,
    next_op: u64,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            tokens: IterableMap::new(b"t"),
            purchases: LookupMap::new(b"p"),
            credits: LookupMap::new(b"c"),
            withdrawals: LookupMap::new(b"w"),
            mint_requests: LookupMap::new(b"m"),
            operations: LookupMap::new(b"o"),
            practice_requests: LookupMap::new(b"d"),
            next_id: 0,
            next_op: 0,
        }
    }

    pub fn get_frontend_config(&self) -> Value {
        json!({"abi_version":"writ-ui-v1","executor_code_hash":Self::executor_hash(),"template_hashes":{"contract-owner":Self::hash(OWNER.as_bytes()),"dao-council":Self::hash(DAO.as_bytes())},"purchase_storage_deposit":STORAGE_FEE.to_string(),"executor_reserve":"50000000000000000000000","max_loans":8,"max_argument_bytes":4096,"zero_deposit_actions_only":true})
    }
    pub fn get_template(&self, template_id: String) -> Value {
        near_sdk::serde_json::from_str(Self::template_source(&template_id)).expect("Template")
    }
    pub fn get_mint_quote(&self, template_id: String, target: AccountId) -> Value {
        Self::template(&template_id);
        require!(
            target != env::current_account_id(),
            "External target required"
        );
        let executor_funding = Self::executor_funding();
        let storage_fee = env::storage_byte_cost().as_yoctonear() * MINT_STORAGE_BYTES;
        json!({"executorFunding":executor_funding.to_string(),"storageDeposit":storage_fee.to_string(),"deposit":(executor_funding+storage_fee).to_string(),"nonRefundableStorage":true})
    }

    #[payable]
    pub fn mint(
        &mut self,
        template_id: String,
        target: AccountId,
        client_request_id: String,
    ) -> Promise {
        Self::client_id(&client_request_id);
        Self::template(&template_id);
        require!(
            target != env::current_account_id(),
            "External target required"
        );
        let owner = env::predecessor_account_id();
        let request = format!("{owner}:{client_request_id}");
        require!(
            self.mint_requests.get(&request).is_none(),
            "Mint request already used"
        );
        let funding = Self::executor_funding();
        let fee = env::storage_byte_cost().as_yoctonear() * MINT_STORAGE_BYTES;
        require!(
            env::attached_deposit().as_yoctonear() == funding + fee,
            "Attach the quoted deposit exactly"
        );
        self.next_id += 1;
        let id = self.next_id.to_string();
        let executor: AccountId = format!("w{id}.{}", env::current_account_id())
            .parse()
            .expect("Executor name too long");
        let mut token = Token {
            id: id.clone(),
            owner: owner.clone(),
            target: target.clone(),
            executor: executor.clone(),
            template_id: template_id.clone(),
            template_hash: Self::hash(Self::template_source(&template_id).as_bytes()),
            state: State::Creating,
            executor_ready: false,
            wrapped: false,
            nonce: 0,
            epoch: 0,
            pending: 1,
            price: 0,
            loans: vec![],
            history: vec![],
            lock: None,
        };
        Self::record(
            &mut token,
            "Provisioning started",
            "Executor is being created without keys",
            false,
        );
        self.tokens.insert(id.clone(), token);
        self.mint_requests.insert(request, id.clone());
        self.ensure_credit(&owner);
        Promise::new(executor)
            .create_account()
            .transfer(NearToken::from_yoctonear(funding))
            .deploy_contract(EXECUTOR.to_vec())
            .function_call(
                "new",
                json!({"parent":env::current_account_id(),"target":target})
                    .to_string()
                    .into_bytes(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(10),
            )
            .then(Self::callback(
                "on_mint",
                json!({"token_id":id,"refund":U128(funding)}),
                30,
            ))
    }
    #[private]
    pub fn on_mint(&mut self, token_id: String, refund: U128) -> bool {
        let Some(mut token) = self.tokens.get(&token_id).cloned() else {
            return false;
        };
        if token.state != State::Creating {
            return false;
        }
        token.pending = 0;
        let ok = Self::succeeded(0);
        if ok {
            token.state = State::Idle;
            token.executor_ready = true;
            Self::record(
                &mut token,
                "Writ minted",
                "Executor provisioned without keys",
                false,
            );
            Self::nft_event(
                "nft_mint",
                json!({"owner_id":token.owner,"token_ids":[token.id]}),
            );
        } else {
            token.state = State::Retired;
            self.credit(&token.owner, refund.0);
            Self::record(
                &mut token,
                "Provisioning failed",
                "Deposit credited for recovery",
                true,
            );
        }
        self.tokens.insert(token_id, token);
        ok
    }
    pub fn get_mint_result(&self, owner_id: AccountId, client_request_id: String) -> Value {
        let key = format!("{owner_id}:{client_request_id}");
        self.mint_requests.get(&key).and_then(|id|self.tokens.get(id)).map(|t|json!({"tokenId":t.id,"status":if t.state==State::Creating{"creating"}else if t.state==State::Retired{"failed"}else{"ready"}})).unwrap_or(Value::Null)
    }
    pub fn get_writ(&self, token_id: String) -> Value {
        self.tokens
            .get(&token_id)
            .filter(|t| t.state != State::Retired)
            .map(Self::token_view)
            .unwrap_or(Value::Null)
    }
    pub fn get_writs(
        &self,
        owner_id: Option<AccountId>,
        listed_only: Option<bool>,
        cursor: Option<String>,
        limit: Option<u32>,
    ) -> Value {
        let mut scanned = cursor.and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
        let size = limit.unwrap_or(24).clamp(1, 24) as usize;
        let end = scanned.saturating_add(256).min(self.next_id);
        let mut items = vec![];
        while scanned < end && items.len() < size {
            scanned += 1;
            if let Some(t) = self.tokens.get(&scanned.to_string()) {
                if t.state != State::Retired
                    && t.state != State::Creating
                    && owner_id.as_ref().is_none_or(|id| id == &t.owner)
                    && (!listed_only.unwrap_or(false)
                        || t.state == State::Listed
                        || t.state == State::SaleLocked)
                {
                    items.push(Self::token_view(t));
                }
            }
        }
        json!({"items":items,"nextCursor":if scanned<self.next_id{Some(scanned.to_string())}else{None}})
    }
    pub fn get_history(
        &self,
        token_id: String,
        cursor: Option<String>,
        limit: Option<u32>,
    ) -> Value {
        let token = self.tokens.get(&token_id).expect("Unknown Writ");
        let start = cursor.and_then(|s| s.parse::<usize>().ok()).unwrap_or(0);
        let end = (start + limit.unwrap_or(50).min(50) as usize).min(token.history.len());
        json!({"entries":token.history.get(start..end).unwrap_or(&[]),"nextCursor":if end<token.history.len(){Some(end.to_string())}else{None},"retainedHistoryLimit":64})
    }

    pub fn execute(
        &mut self,
        token_id: String,
        target_method: String,
        args: Value,
        deposit: U128,
    ) -> Promise {
        require!(deposit.0 == 0, "Only zero-deposit role actions supported");
        let mut t = self.active(&token_id);
        Self::unpaused(&t);
        let actor = env::predecessor_account_id();
        let encoded = Self::arguments(&args);
        let template = Self::template(&t.template_id);
        require!(
            template.actions.iter().any(|a| a.method == target_method),
            "Undeclared action"
        );
        require!(
            actor == t.owner
                || t.loans.iter().any(|l| l.borrower == actor
                    && l.method == target_method
                    && l.args_json == encoded
                    && l.epoch == t.epoch
                    && l.expires_at_ms > env::block_timestamp_ms()),
            "No permission for these arguments"
        );
        t.pending += 1;
        t.nonce += 1;
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        Self::record(&mut t, "Role action started", &target_method, false);
        let executor = t.executor.clone();
        self.tokens.insert(token_id.clone(), t);
        Self::forward(executor,target_method,args).then(Self::callback("on_operation",json!({"token_id":token_id,"operation_id":op,"kind":"execute","refund_to":actor,"refund":U128(0)}),30))
    }
    pub fn lend(
        &mut self,
        token_id: String,
        borrower_id: AccountId,
        method: String,
        args: Value,
        max_deposit: U128,
        expires_at_ms: near_sdk::json_types::U64,
    ) -> String {
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        t.loans
            .retain(|l| l.expires_at_ms > env::block_timestamp_ms());
        require!(t.loans.len() < 8, "Loan limit reached");
        require!(borrower_id != t.owner, "Borrower already holds Writ");
        require!(max_deposit.0 == 0, "Zero-deposit loans only");
        require!(
            expires_at_ms.0 > env::block_timestamp_ms()
                && expires_at_ms.0 <= env::block_timestamp_ms() + 366 * 86400_000,
            "Expiry must be within one year"
        );
        require!(
            Self::template(&t.template_id)
                .actions
                .iter()
                .any(|a| a.method == method && a.lendable),
            "Method cannot be lent"
        );
        let id = self.op().to_string();
        t.loans.push(Loan {
            id: id.clone(),
            borrower: borrower_id,
            method: method.clone(),
            args_json: Self::arguments(&args),
            expires_at_ms: expires_at_ms.0,
            epoch: t.epoch,
        });
        t.nonce += 1;
        Self::record(&mut t, "Method lent", &method, false);
        self.tokens.insert(token_id, t);
        id
    }
    pub fn end_loan(&mut self, token_id: String, loan_id: String) {
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        let old = t.loans.len();
        t.loans.retain(|l| l.id != loan_id);
        require!(t.loans.len() != old, "Unknown loan");
        t.nonce += 1;
        Self::record(&mut t, "Loan ended", &loan_id, false);
        self.tokens.insert(token_id, t);
    }

    #[payable]
    pub fn fund_executor(&mut self, token_id: String) -> Promise {
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        let amount = env::attached_deposit();
        require!(amount.as_yoctonear() > 0, "Funding required");
        let actor = env::predecessor_account_id();
        self.ensure_credit(&actor);
        t.pending += 1;
        t.nonce += 1;
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        let executor = t.executor.clone();
        self.tokens.insert(token_id.clone(), t);
        Promise::new(executor).transfer(amount).then(Self::callback("on_operation",json!({"token_id":token_id,"operation_id":op,"kind":"fund","refund_to":actor,"refund":U128(amount.as_yoctonear())}),30))
    }
    pub fn withdraw_fees(&mut self, token_id: String, amount: U128) -> Promise {
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        require!(amount.0 > 0, "Positive amount required");
        t.pending += 1;
        t.nonce += 1;
        let executor = t.executor.clone();
        let receiver = t.owner.clone();
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        self.tokens.insert(token_id.clone(), t);
        Promise::new(executor).function_call("withdraw",json!({"receiver_id":receiver,"amount":amount}).to_string().into_bytes(),NearToken::from_yoctonear(0),Gas::from_tgas(20))
          .then(Self::callback("on_operation",json!({"token_id":token_id,"operation_id":op,"kind":"withdraw","refund_to":receiver,"refund":U128(0)}),30))
    }
    #[private]
    pub fn on_operation(
        &mut self,
        token_id: String,
        operation_id: u64,
        kind: String,
        refund_to: AccountId,
        refund: U128,
    ) -> bool {
        if self.operations.remove(&operation_id).as_ref() != Some(&token_id) {
            return false;
        }
        let Some(mut t) = self.tokens.get(&token_id).cloned() else {
            return false;
        };
        if t.pending == 0 {
            return false;
        }
        t.pending -= 1;
        let ok = if kind == "execute" || kind == "wrap" {
            Self::response(0).and_then(|v| v.as_bool()).unwrap_or(false)
        } else {
            Self::succeeded(0)
        };
        if !ok && refund.0 > 0 {
            self.credit(&refund_to, refund.0);
        }
        if ok && kind == "wrap" {
            t.wrapped = true;
        }
        Self::record(
            &mut t,
            if ok {
                "Action completed"
            } else {
                "Action failed"
            },
            &format!("{kind} #{operation_id}"),
            !ok,
        );
        self.tokens.insert(token_id, t);
        ok
    }

    pub fn wrap_step(&mut self, token_id: String, step: u32) -> Promise {
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        require!(
            t.template_id == "contract-owner" && step == 1,
            "Unsupported wrap step"
        );
        t.pending += 1;
        t.nonce += 1;
        let executor = t.executor.clone();
        let actor = t.owner.clone();
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        self.tokens.insert(token_id.clone(), t);
        Self::forward(executor,"own_accept_owner".into(),json!({})).then(Self::callback("on_operation",json!({"token_id":token_id,"operation_id":op,"kind":"wrap","refund_to":actor,"refund":U128(0)}),30))
    }
    pub fn confirm_wrap(&mut self, token_id: String) -> Promise {
        let mut t = self.owned(&token_id);
        Self::unpaused(&t);
        t.pending = 1;
        t.nonce += 1;
        let op = self.op();
        self.operations.insert(op, token_id.clone());
        let calls = self.check_promises(&t);
        self.tokens.insert(token_id.clone(), t);
        calls.then(Self::callback(
            "on_confirm_wrap",
            json!({"token_id":token_id,"operation_id":op}),
            40,
        ))
    }
    #[private]
    pub fn on_confirm_wrap(&mut self, token_id: String, operation_id: u64) -> bool {
        if self.operations.remove(&operation_id).as_ref() != Some(&token_id) {
            return false;
        }
        let mut t = self.active(&token_id);
        require!(t.pending == 1, "Wrap state changed");
        t.pending = 0;
        let passed = Self::template(&t.template_id)
            .checks
            .iter()
            .enumerate()
            .all(|(i, def)| {
                Self::matches_check(def, Self::response(i as u64).as_ref(), &t.executor)
            });
        t.wrapped = passed;
        Self::record(
            &mut t,
            if passed {
                "Role confirmed"
            } else {
                "Role not confirmed"
            },
            "Declared template predicates checked",
            !passed,
        );
        self.tokens.insert(token_id, t);
        passed
    }
    pub fn list(&mut self, token_id: String, price: U128, expected_nonce: String) {
        let mut t = self.owned(&token_id);
        require!(
            t.state == State::Idle || t.state == State::Listed,
            "Writ is paused"
        );
        require!(t.wrapped, "Confirm the role handover first");
        require!(t.pending == 0, "Calls in flight");
        require!(t.nonce.to_string() == expected_nonce, "Version changed");
        require!(price.0 > 0, "Positive price required");
        t.price = price.0;
        t.state = State::Listed;
        t.nonce += 1;
        Self::record(&mut t, "Listed for sale", &price.0.to_string(), false);
        self.tokens.insert(token_id, t);
    }
    pub fn unlist(&mut self, token_id: String) {
        let mut t = self.owned(&token_id);
        require!(t.state == State::Listed, "Not listed");
        t.state = State::Idle;
        t.price = 0;
        t.nonce += 1;
        Self::record(&mut t, "Listing removed", "Actions resumed", false);
        self.tokens.insert(token_id, t);
    }

    #[payable]
    pub fn buy(
        &mut self,
        token_id: String,
        expected_nonce: String,
        expected_template_hash: String,
        maximum_price: U128,
        pins: Vec<Pin>,
        client_attempt_id: String,
    ) -> Promise {
        Self::client_id(&client_attempt_id);
        let mut t = self.active(&token_id);
        require!(
            t.state == State::Listed && t.pending == 0,
            "Writ unavailable"
        );
        require!(
            t.nonce.to_string() == expected_nonce && t.template_hash == expected_template_hash,
            "Version changed"
        );
        require!(maximum_price.0 == t.price, "Price changed");
        let buyer = env::predecessor_account_id();
        Self::require_external_receiver(&buyer);
        require!(buyer != t.owner, "Already the holder");
        require!(
            env::attached_deposit().as_yoctonear() == t.price + STORAGE_FEE,
            "Attach price plus quoted storage deposit"
        );
        require!(
            pins.len() <= 1 && pins.iter().all(|p| p.id == "minimum_balance"),
            "Unsupported buyer condition"
        );
        let key = Self::purchase_key(&token_id, &buyer, &client_attempt_id);
        require!(self.purchases.get(&key).is_none(), "Attempt already used");
        self.ensure_credit(&buyer);
        self.ensure_credit(&t.owner);
        let purchase = Purchase {
            key: key.clone(),
            client_id: client_attempt_id,
            token_id: token_id.clone(),
            buyer,
            seller: t.owner.clone(),
            amount: t.price,
            expected_nonce: t.nonce,
            status: PurchaseStatus::Checking,
            started: env::block_height(),
            deadline: env::block_height() + DEADLINE,
            checks: vec![],
            pins,
            ended_loans: vec![],
            refund_paid: false,
            refund_pending: false,
        };
        t.state = State::SaleLocked;
        t.lock = Some(key.clone());
        let calls = self.check_promises(&t);
        self.purchases.insert(key.clone(), purchase);
        self.tokens.insert(token_id, t);
        calls.then(Self::callback("on_checks", json!({"key":key}), 55))
    }
    #[private]
    pub fn on_checks(&mut self, key: String) -> bool {
        let Some(mut p) = self.purchases.get(&key).cloned() else {
            return false;
        };
        if p.status != PurchaseStatus::Checking {
            return false;
        }
        let Some(mut t) = self.tokens.get(&p.token_id).cloned() else {
            return false;
        };
        if t.lock.as_ref() != Some(&key) {
            return false;
        }
        let template = Self::template(&t.template_id);
        let mut checks = vec![];
        for (i, def) in template.checks.iter().enumerate() {
            let response = Self::response(i as u64);
            let expected = resolve(&def.expected, &t.executor);
            let actual = response
                .as_ref()
                .and_then(|v| v.pointer(&def.pointer))
                .cloned();
            let pass = Self::matches_check(def, response.as_ref(), &t.executor);
            checks.push(Self::evidence(
                &def.id,
                &def.label,
                &def.method,
                actual.unwrap_or(Value::Null),
                expected,
                if response.is_none() {
                    "unavailable"
                } else if pass {
                    "pass"
                } else {
                    "fail"
                },
            ));
        }
        let balance = Self::response(template.checks.len() as u64)
            .and_then(|v| v.as_str().and_then(|s| s.parse::<u128>().ok()));
        for pin in &p.pins {
            checks.push(Self::evidence(
                &pin.id,
                "Minimum executor balance",
                "get_balance",
                balance.map(|b| json!(b.to_string())).unwrap_or(Value::Null),
                json!(pin.value.0.to_string()),
                if balance.is_none() {
                    "unavailable"
                } else if balance.unwrap() >= pin.value.0 {
                    "pass"
                } else {
                    "fail"
                },
            ));
        }
        let local = t.nonce == p.expected_nonce
            && t.pending == 0
            && t.owner == p.seller
            && env::block_height() <= p.deadline;
        checks.push(Self::evidence(
            "version",
            "Writ unchanged and no calls in flight",
            "get_writ",
            json!(t.nonce.to_string()),
            json!(p.expected_nonce.to_string()),
            if local { "pass" } else { "fail" },
        ));
        let passed = local && checks.iter().all(|c| c.result == "pass");
        p.checks = checks;
        t.lock = None;
        if passed {
            p.status = PurchaseStatus::Settled;
            p.ended_loans = t.loans.iter().map(|l| l.id.clone()).collect();
            let seller = t.owner.clone();
            t.owner = p.buyer.clone();
            t.epoch += 1;
            t.nonce += 1;
            t.loans.clear();
            t.state = State::Idle;
            t.price = 0;
            self.credit(&seller, p.amount);
            Self::record(
                &mut t,
                "Sale settled",
                &format!("From {seller} to {}", p.buyer),
                false,
            );
            Self::nft_event(
                "nft_transfer",
                json!({"old_owner_id":seller,"new_owner_id":t.owner,"token_ids":[t.id],"memo":"Conditional purchase settled"}),
            );
        } else {
            p.status = PurchaseStatus::Refused;
            t.state = State::Listed;
            Self::record(
                &mut t,
                "Purchase refused",
                "Purchase price held for buyer refund",
                true,
            );
        }
        self.tokens.insert(p.token_id.clone(), t);
        self.purchases.insert(key, p);
        passed
    }
    pub fn get_purchase(
        &self,
        token_id: String,
        buyer_id: AccountId,
        client_attempt_id: String,
    ) -> Value {
        self.purchases
            .get(&Self::purchase_key(
                &token_id,
                &buyer_id,
                &client_attempt_id,
            ))
            .map(Self::purchase_view)
            .unwrap_or(Value::Null)
    }
    pub fn release_stuck(
        &mut self,
        token_id: String,
        buyer_id: AccountId,
        client_attempt_id: String,
    ) {
        let key = Self::purchase_key(&token_id, &buyer_id, &client_attempt_id);
        let mut p = self.purchases.get(&key).cloned().expect("Unknown purchase");
        require!(
            p.status == PurchaseStatus::Checking && env::block_height() > p.deadline,
            "Not releasable"
        );
        let mut t = self.active(&token_id);
        require!(t.lock.as_ref() == Some(&key), "Attempt is not active");
        p.status = PurchaseStatus::Released;
        t.state = State::Listed;
        t.lock = None;
        self.purchases.insert(key, p.clone());
        self.tokens.insert(token_id, t);
    }
    pub fn claim_refund(
        &mut self,
        token_id: String,
        buyer_id: AccountId,
        client_attempt_id: String,
    ) -> Promise {
        let key = Self::purchase_key(&token_id, &buyer_id, &client_attempt_id);
        let mut p = self.purchases.get(&key).cloned().expect("Unknown purchase");
        require!(p.buyer == env::predecessor_account_id(), "Buyer only");
        require!(
            (p.status == PurchaseStatus::Refused || p.status == PurchaseStatus::Released)
                && !p.refund_paid
                && !p.refund_pending,
            "Refund unavailable"
        );
        p.refund_pending = true;
        self.purchases.insert(key.clone(), p.clone());
        self.send_credit(p.buyer, p.amount, Some(key))
    }
    pub fn get_credit(&self, account_id: AccountId) -> U128 {
        U128(*self.credits.get(&account_id).unwrap_or(&0))
    }
    pub fn withdraw_credit(&mut self, amount: U128) -> Promise {
        self.send_credit(env::predecessor_account_id(), amount.0, None)
    }
    #[private]
    pub fn on_credit(&mut self, operation_id: u64) -> bool {
        let Some(transfer) = self.withdrawals.remove(&operation_id) else {
            return false;
        };
        let ok = Self::succeeded(0);
        if !ok && transfer.purchase.is_none() {
            self.credit(&transfer.account, transfer.amount);
        }
        if let Some(key) = transfer.purchase {
            if let Some(mut p) = self.purchases.get(&key).cloned() {
                p.refund_pending = false;
                p.refund_paid = ok;
                self.purchases.insert(key, p);
            }
        }
        ok
    }
}

impl Contract {
    fn require_external_receiver(receiver: &AccountId) {
        let collection = env::current_account_id();
        require!(
            receiver != &collection && !receiver.as_str().ends_with(&format!(".{collection}")),
            "Writ infrastructure cannot receive its own role NFTs"
        );
    }
    fn matches_check(def: &Check, response: Option<&Value>, executor: &AccountId) -> bool {
        let expected = resolve(&def.expected, executor);
        response
            .and_then(|v| v.pointer(&def.pointer))
            .is_some_and(|v| match def.operator.as_str() {
                "eq" => v == &expected,
                "null" => v.is_null(),
                "contains" => v.as_array().is_some_and(|a| a.contains(&expected)),
                "group_member" => v.as_array().is_some_and(|roles| {
                    roles.iter().any(|role| {
                        role.get("name").and_then(Value::as_str) == def.group_name.as_deref()
                            && role
                                .pointer("/kind/Group")
                                .and_then(Value::as_array)
                                .is_some_and(|group| group.contains(&expected))
                    })
                }),
                _ => false,
            })
    }
    fn op(&mut self) -> u64 {
        self.next_op += 1;
        self.next_op
    }
    fn active(&self, id: &str) -> Token {
        let t = self
            .tokens
            .get(&id.to_string())
            .cloned()
            .expect("Unknown Writ");
        require!(
            t.state != State::Retired && t.state != State::Creating,
            "Writ not ready"
        );
        t
    }
    fn owned(&self, id: &str) -> Token {
        let t = self.active(id);
        require!(t.owner == env::predecessor_account_id(), "Holder only");
        t
    }
    fn unpaused(t: &Token) {
        require!(t.state == State::Idle, "Paused while listed or locked");
        require!(t.pending == 0, "Call in flight");
    }
    fn hash(bytes: &[u8]) -> String {
        env::sha256(bytes)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    }
    fn executor_hash() -> String {
        use near_sdk::bs58;
        bs58::encode(env::sha256(EXECUTOR)).into_string()
    }
    fn template_source(id: &str) -> &'static str {
        match id {
            "contract-owner" => OWNER,
            "dao-council" => DAO,
            _ => env::panic_str("Unsupported template"),
        }
    }
    fn template(id: &str) -> Template {
        near_sdk::serde_json::from_str(Self::template_source(id)).expect("Template")
    }
    fn executor_funding() -> u128 {
        env::storage_byte_cost().as_yoctonear() * (EXECUTOR.len() as u128 + 4096)
            + 100_000_000_000_000_000_000_000
    }
    fn client_id(id: &str) {
        require!(
            !id.is_empty()
                && id.len() <= 64
                && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-'),
            "Invalid request ID"
        );
    }
    fn arguments(args: &Value) -> String {
        require!(args.is_object(), "JSON object required");
        let s = near_sdk::serde_json::to_string(args).expect("JSON");
        require!(s.len() <= 4096, "Arguments exceed limit");
        s
    }
    fn forward(executor: AccountId, method: String, args: Value) -> Promise {
        Promise::new(executor).function_call(
            "execute",
            json!({"method":method,"args":args})
                .to_string()
                .into_bytes(),
            NearToken::from_yoctonear(0),
            Gas::from_tgas(70),
        )
    }
    fn callback(method: &str, args: Value, gas: u64) -> Promise {
        Promise::new(env::current_account_id()).function_call(
            method,
            args.to_string().into_bytes(),
            NearToken::from_yoctonear(0),
            Gas::from_tgas(gas),
        )
    }
    fn succeeded(index: u64) -> bool {
        matches!(env::promise_result_checked(index, 4096), Ok(_))
    }
    fn response(index: u64) -> Option<Value> {
        env::promise_result_checked(index, 65536)
            .ok()
            .and_then(|bytes| near_sdk::serde_json::from_slice(&bytes).ok())
    }
    fn check_promises(&self, t: &Token) -> Promise {
        let mut calls = None;
        for check in Self::template(&t.template_id).checks {
            let target = if check.target == "executor" {
                t.executor.clone()
            } else {
                t.target.clone()
            };
            let call = Promise::new(target).function_call(
                check.method,
                b"{}".to_vec(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(15),
            );
            calls = Some(if let Some(prior) = calls {
                Promise::and(prior, call)
            } else {
                call
            });
        }
        let balance = Promise::new(t.executor.clone()).function_call(
            "get_balance",
            b"{}".to_vec(),
            NearToken::from_yoctonear(0),
            Gas::from_tgas(10),
        );
        calls.expect("At least one check").and(balance)
    }
    fn evidence(
        id: &str,
        label: &str,
        method: &str,
        actual: Value,
        expected: Value,
        result: &str,
    ) -> Evidence {
        let mut actual_json = actual.to_string();
        if actual_json.len() > 512 {
            actual_json = json!("Response exceeds evidence preview limit").to_string();
        }
        Evidence {
            id: id.into(),
            label: label.into(),
            method: method.into(),
            actual_json,
            expected_json: expected.to_string(),
            result: result.into(),
            block: env::block_height(),
            at: env::block_timestamp_ms(),
        }
    }
    fn ensure_credit(&mut self, account: &AccountId) {
        if self.credits.get(account).is_none() {
            self.credits.insert(account.clone(), 0);
        }
    }
    fn credit(&mut self, account: &AccountId, amount: u128) {
        let current = *self.credits.get(account).unwrap_or(&0);
        self.credits.insert(
            account.clone(),
            current.checked_add(amount).expect("Credit overflow"),
        );
    }
    fn send_credit(
        &mut self,
        account: AccountId,
        amount: u128,
        purchase: Option<String>,
    ) -> Promise {
        let current = *self.credits.get(&account).unwrap_or(&0);
        require!(amount > 0, "Positive payment required");
        if purchase.is_none() {
            require!(amount <= current, "Insufficient credit");
            self.credits.insert(account.clone(), current - amount);
        }
        let id = self.op();
        self.withdrawals.insert(
            id,
            CreditTransfer {
                account: account.clone(),
                amount,
                purchase,
            },
        );
        Promise::new(account)
            .transfer(NearToken::from_yoctonear(amount))
            .then(Self::callback("on_credit", json!({"operation_id":id}), 20))
    }
    fn purchase_key(token: &str, buyer: &AccountId, client: &str) -> String {
        format!("{token}:{buyer}:{client}")
    }
    fn record(t: &mut Token, event: &str, detail: &str, refused: bool) {
        if t.history.len() >= 64 {
            t.history.remove(0);
        }
        let entry = History {
            id: format!("{}-{}-{}", t.nonce, env::block_height(), t.history.len()),
            at: utc(env::block_timestamp_ms()),
            event: event.into(),
            actor: env::predecessor_account_id(),
            detail: detail.chars().take(160).collect(),
            refused,
        };
        env::log_str(&format!(
            "EVENT_JSON:{}",
            json!({"standard":"writ","version":"1.0.0","event":event,"data":[{"token_id":t.id,"owner_id":t.owner,"epoch":t.epoch.to_string(),"nonce":t.nonce.to_string(),"detail":entry.detail}]})
        ));
        t.history.push(entry);
    }
    fn nft_event(event: &str, data: Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            json!({"standard":"nep171","version":"1.0.0","event":event,"data":[data]})
        ));
    }
    fn token_view(t: &Token) -> Value {
        json!({"id":t.id,"collection":env::current_account_id(),"owner":t.owner,"executor":t.executor,"target":t.target,"templateId":t.template_id,"templateHash":t.template_hash,"executorCodeHash":Self::executor_hash(),"epoch":t.epoch.to_string(),"nonce":t.nonce.to_string(),"pendingCalls":t.pending,"status":match t.state{State::Listed=>"listed",State::SaleLocked|State::ReceiverLocked=>"locked",_=>if t.loans.iter().any(|l|l.epoch==t.epoch&&l.expires_at_ms>env::block_timestamp_ms()){"lent"}else{"held"}},"price":if t.price>0{Some(t.price.to_string())}else{None},"balance":"0","withdrawableFees":"0","tokens":[],"loans":t.loans.iter().filter(|l|l.epoch==t.epoch&&l.expires_at_ms>env::block_timestamp_ms()).map(|l|json!({"id":l.id,"borrower":l.borrower,"method":l.method,"args":near_sdk::serde_json::from_str::<Value>(&l.args_json).unwrap_or(Value::Null),"maxDeposit":"0","expiresAt":utc(l.expires_at_ms),"epoch":l.epoch.to_string()})).collect::<Vec<_>>(),"roleOwner":t.executor,"proposedOwner":null,"accessKeys":[],"provisioned":t.executor_ready,"roleConfirmed":t.wrapped,"unwrapPending":t.state==State::Unwrapping})
    }
    fn purchase_view(p: &Purchase) -> Value {
        let refund = if p.refund_paid {
            "paid"
        } else if p.refund_pending {
            "pending"
        } else {
            "claimable"
        };
        match p.status {
            PurchaseStatus::Checking => {
                if env::block_height() > p.deadline {
                    json!({"status":"releasable"})
                } else {
                    json!({"status":"checking","deadlineBlock":p.deadline.to_string()})
                }
            }
            PurchaseStatus::Settled => {
                json!({"status":"settled","holder":p.buyer,"seller":p.seller,"price":p.amount.to_string(),"endedLoanIds":p.ended_loans,"sellerPayment":"credited"})
            }
            PurchaseStatus::Released => json!({"status":"released","refundStatus":refund}),
            PurchaseStatus::Refused => {
                json!({"status":"refused","refundStatus":refund,"checks":p.checks.iter().map(|c|json!({"id":c.id,"label":c.label,"method":c.method,"actual":near_sdk::serde_json::from_str::<Value>(&c.actual_json).unwrap_or(Value::Null),"expected":near_sdk::serde_json::from_str::<Value>(&c.expected_json).unwrap_or(Value::Null),"result":c.result,"enforcedBy":"sale","read":{"blockHeight":c.block.to_string(),"blockHash":null,"observedAtMs":c.at,"source":"testnet","phase":"settlement_callback"}})).collect::<Vec<_>>()})
            }
        }
    }
}
