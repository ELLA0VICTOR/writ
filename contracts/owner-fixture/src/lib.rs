//! Demonstration target. Ownership implementation is upstream contract-tools 4.0.0.
use near_sdk::json_types::U128;
use near_sdk::{AccountId, NearToken, PanicOnDefault, Promise, env, near, require};
use near_sdk_contract_tools::nft::Token;
use near_sdk_contract_tools::standard::{nep141, nep148, nep177};
use near_sdk_contract_tools::{Nep141, Nep148, Nep171, Nep177, Nep181, Owner, owner::Owner};
#[near(contract_state)]
#[derive(Owner, Nep171, Nep177, Nep181, Nep141, Nep148, PanicOnDefault)]
#[nep171(
    all_hooks = "near_sdk_contract_tools::standard::nep181::TokenEnumeration",
    token_data = "nep177::TokenMetadata"
)]
pub struct Contract {
    price: String,
    calls: u64,
    profile: String,
}
#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, profile: Option<String>) -> Self {
        let profile = profile.unwrap_or_else(|| "contract-owner".into());
        require!(
            [
                "contract-owner",
                "collection-admin",
                "token-issuer",
                "treasury-controller"
            ]
            .contains(&profile.as_str()),
            "Unknown integration profile"
        );
        let mut contract = Self {
            price: "1".into(),
            calls: 0,
            profile,
        };
        Owner::init(&mut contract, &owner_id);
        nep177::Nep177Controller::set_contract_metadata(
            &mut contract,
            &nep177::ContractMetadata::new("Writ practice collection", "WPC", None),
        );
        nep148::Nep148Controller::set_metadata(
            &mut contract,
            &nep148::ContractMetadata::new("Writ practice credits", "WPC", 0),
        );
        contract
    }
    pub fn get_integration_profile(&self) -> &str {
        &self.profile
    }

    /// Compatible example: the administrative mint command is application-specific;
    /// the token and its transfers use upstream NEP-171 implementation.
    pub fn mint_collectible(&mut self, token_id: String, receiver_id: AccountId, title: String) {
        self.require_profile("collection-admin");
        require!(
            !token_id.is_empty() && token_id.len() <= 64 && title.len() <= 128,
            "Invalid collectible"
        );
        nep177::Nep177Controller::mint_with_metadata(
            self,
            &token_id,
            &receiver_id,
            &nep177::TokenMetadata::new().title(title),
        )
        .expect("Mint rejected");
        self.require_storage_budget();
    }
    /// Compatible example: mint is owner-only; NEP-141 itself does not standardize mint authority.
    pub fn mint_tokens(&mut self, receiver_id: AccountId, amount: U128) {
        self.require_profile("token-issuer");
        require!(
            amount.0 > 0 && amount.0 <= 1_000_000,
            "Mint 1 to 1000000 credits per call"
        );
        nep141::Nep141Controller::mint(self, &nep141::Nep141Mint::new(amount.0, &*receiver_id))
            .expect("Mint rejected");
        self.require_storage_budget();
    }
    #[payable]
    pub fn fund_treasury(&mut self) {
        require!(
            env::attached_deposit().as_yoctonear() > 0,
            "Deposit required"
        );
    }
    pub fn treasury_available(&self) -> U128 {
        U128(env::account_balance().as_yoctonear().saturating_sub(
            u128::from(env::storage_usage()) * env::storage_byte_cost().as_yoctonear()
                + 100_000_000_000_000_000_000_000,
        ))
    }
    pub fn treasury_pay(&mut self, receiver_id: AccountId, amount: U128) -> Promise {
        self.require_profile("treasury-controller");
        require!(
            amount.0 > 0 && amount.0 <= self.treasury_available().0,
            "Insufficient treasury funds"
        );
        Promise::new(receiver_id).transfer(NearToken::from_yoctonear(amount.0))
    }
    pub fn set_price(&mut self, price: String) {
        Self::require_owner();
        require!(
            price.len() <= 32 && price.parse::<u128>().is_ok(),
            "Invalid price"
        );
        self.price = price;
        self.calls += 1;
    }
    pub fn get_price(&self) -> &str {
        &self.price
    }
    pub fn get_calls(&self) -> u64 {
        self.calls
    }
    #[payable]
    pub fn pay_service(&mut self, receiver_id: AccountId) -> Promise {
        require!(
            env::attached_deposit().as_yoctonear() > 0,
            "Deposit required"
        );
        Promise::new(receiver_id).transfer(env::attached_deposit())
    }
    pub fn fail(&self) {
        Self::require_owner();
        env::panic_str("Intentional target failure");
    }
    pub fn delayed(&self, target: AccountId) -> Promise {
        Self::require_owner();
        Promise::new(target).function_call(
            "get_price",
            b"{}".to_vec(),
            NearToken::from_yoctonear(0),
            near_sdk::Gas::from_tgas(5),
        )
    }
    pub fn oversized(&self, count: u32) -> String {
        Self::require_owner();
        "x".repeat(count.min(100_000) as usize)
    }
    pub fn balance(&self) -> U128 {
        U128(env::account_balance().as_yoctonear())
    }
}
impl Contract {
    fn require_profile(&self, profile: &str) {
        Self::require_owner();
        require!(self.profile == profile, "Wrong integration profile");
    }
    fn require_storage_budget(&self) {
        require!(
            self.treasury_available().0 > 0,
            "Fund target storage before minting"
        );
    }
}
