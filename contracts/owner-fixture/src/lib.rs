//! Demonstration target. Ownership implementation is upstream contract-tools 4.0.0.
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};
use near_sdk::json_types::U128;
use near_sdk_contract_tools::{owner::Owner, Owner};
#[near(contract_state)]
#[derive(Owner, PanicOnDefault)]
pub struct Contract { price: String, calls: u64 }
#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        let mut contract = Self { price: "1".into(), calls: 0 };
        Owner::init(&mut contract, &owner_id); contract
    }
    pub fn set_price(&mut self, price: String) {
        Self::require_owner();
        require!(price.len() <= 32 && price.parse::<u128>().is_ok(), "Invalid price");
        self.price = price; self.calls += 1;
    }
    pub fn get_price(&self) -> &str { &self.price }
    pub fn get_calls(&self) -> u64 { self.calls }
    #[payable]
    pub fn pay_service(&mut self, receiver_id: AccountId) -> Promise {
        require!(env::attached_deposit().as_yoctonear() > 0, "Deposit required");
        Promise::new(receiver_id).transfer(env::attached_deposit())
    }
    pub fn fail(&self) { Self::require_owner(); env::panic_str("Intentional target failure"); }
    pub fn delayed(&self, target: AccountId) -> Promise {
        Self::require_owner();
        Promise::new(target).function_call("get_price", b"{}".to_vec(), NearToken::from_yoctonear(0), near_sdk::Gas::from_tgas(5))
    }
    pub fn oversized(&self, count: u32) -> String { Self::require_owner(); "x".repeat(count.min(100_000) as usize) }
    pub fn balance(&self) -> U128 { U128(env::account_balance().as_yoctonear()) }
}
