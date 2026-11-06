use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};
use near_sdk::json_types::U128;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Executor { parent: AccountId, target: AccountId }

#[near]
impl Executor {
    #[init]
    pub fn new(parent: AccountId, target: AccountId) -> Self {
        require!(env::predecessor_account_id() == parent, "Parent must initialize");
        require!(target != env::current_account_id() && target != parent, "External target required");
        Self { parent, target }
    }
    pub fn get_balance(&self) -> U128 { U128(self.available()) }
    pub fn get_config(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"parent":self.parent,"target":self.target,"reserve":"50000000000000000000000"})
    }
    pub fn execute(&self, method: String, args: near_sdk::serde_json::Value) -> Promise {
        self.require_parent();
        require!(!method.is_empty() && method.len() <= 64 && method.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_'), "Invalid method");
        let bytes = near_sdk::serde_json::to_vec(&args).expect("JSON");
        require!(bytes.len() <= 4096, "Arguments exceed limit");
        let auth_deposit = if matches!(method.as_str(), "own_accept_owner" | "own_propose_owner") { 1 } else { 0 };
        Promise::new(self.target.clone()).function_call(method, bytes, NearToken::from_yoctonear(auth_deposit), Gas::from_tgas(45))
            .then(Promise::new(env::current_account_id()).function_call("on_target_result", b"{}".to_vec(), NearToken::from_yoctonear(0), Gas::from_tgas(8)))
    }
    #[private]
    pub fn on_target_result(&self) -> bool {
        matches!(env::promise_result_checked(0, 0), Ok(_) | Err(near_sdk::PromiseError::TooLong(_)))
    }
    pub fn withdraw(&self, receiver_id: AccountId, amount: U128) -> Promise {
        self.require_parent();
        require!(amount.0 > 0 && amount.0 <= self.available(), "Insufficient available funds");
        Promise::new(receiver_id).transfer(NearToken::from_yoctonear(amount.0))
    }
}
impl Executor {
    fn require_parent(&self) { require!(env::predecessor_account_id() == self.parent, "Parent only"); }
    fn available(&self) -> u128 {
        let storage = u128::from(env::storage_usage()) * env::storage_byte_cost().as_yoctonear();
        env::account_balance().as_yoctonear().saturating_sub(storage + 50_000_000_000_000_000_000_000)
    }
}
