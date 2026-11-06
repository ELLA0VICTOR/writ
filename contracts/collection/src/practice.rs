//! Optional self-serve demo target. Its real Owner implementation is unchanged.
use crate::{Contract, ContractExt, model::Practice};
use near_sdk::json_types::U128;
use near_sdk::serde_json::{Value, json};
use near_sdk::{AccountId, Gas, NearToken, Promise, env, near, require};
const CODE: &[u8] = include_bytes!("../../../artifacts/owner-fixture.wasm");
const RECORD_BYTES: u128 = 2048;
#[near]
impl Contract {
    pub fn get_practice_quote(&self) -> Value {
        let funding = Self::practice_funding();
        let storage = env::storage_byte_cost().as_yoctonear() * RECORD_BYTES;
        json!({"deposit":(funding+storage).to_string(),"executorFunding":funding.to_string(),"storageDeposit":storage.to_string(),"nonRefundableStorage":true})
    }
    #[payable]
    pub fn create_practice_target(&mut self, client_request_id: String) -> Promise {
        Self::client_id(&client_request_id);
        let owner = env::predecessor_account_id();
        let key = format!("{owner}:{client_request_id}");
        require!(
            self.practice_requests.get(&key).is_none(),
            "Practice request already used"
        );
        let funding = Self::practice_funding();
        require!(
            env::attached_deposit().as_yoctonear()
                == funding + env::storage_byte_cost().as_yoctonear() * RECORD_BYTES,
            "Attach the practice quote exactly"
        );
        let id = self.op();
        let target: AccountId = format!("p{id}.{}", env::current_account_id())
            .parse()
            .expect("Practice account name too long");
        self.practice_requests.insert(
            key.clone(),
            Practice {
                target: target.clone(),
                owner: owner.clone(),
                status: 0,
            },
        );
        self.ensure_credit(&owner);
        Promise::new(target)
            .create_account()
            .transfer(NearToken::from_yoctonear(funding))
            .deploy_contract(CODE.to_vec())
            .function_call(
                "new",
                json!({"owner_id":owner}).to_string().into_bytes(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(12),
            )
            .then(Self::callback(
                "on_practice",
                json!({"key":key,"funding":U128(funding)}),
                25,
            ))
    }
    #[private]
    pub fn on_practice(&mut self, key: String, funding: U128) -> bool {
        let Some(mut entry) = self.practice_requests.get(&key).cloned() else {
            return false;
        };
        if entry.status != 0 {
            return false;
        }
        let ok = Self::succeeded(0);
        entry.status = if ok { 1 } else { 2 };
        if !ok {
            self.credit(&entry.owner, funding.0);
        }
        self.practice_requests.insert(key, entry);
        ok
    }
    pub fn get_practice_target(&self, owner_id: AccountId, client_request_id: String) -> Value {
        self.practice_requests.get(&format!("{owner_id}:{client_request_id}")).map(|p|json!({"target":p.target,"status":match p.status{1=>"ready",2=>"failed",_=>"creating"}})).unwrap_or(Value::Null)
    }
}
impl Contract {
    fn practice_funding() -> u128 {
        env::storage_byte_cost().as_yoctonear() * (CODE.len() as u128 + 4096)
            + 50_000_000_000_000_000_000_000
    }
}
