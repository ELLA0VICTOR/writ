//! Sandbox-only hostile target/receiver. Never part of the production template registry.
use near_sdk::{env,near,require,AccountId,Gas,GasWeight,PanicOnDefault,Promise,PromiseOrValue,YieldId};
use near_sdk::serde_json::{json,Value};
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Adversary { owner:AccountId, proposed:Option<AccountId>, hold:bool, yield_id:Option<YieldId>, attempts:u32 }
#[near]
impl Adversary {
 #[init] pub fn new(owner_id:AccountId)->Self {Self{owner:owner_id,proposed:None,hold:false,yield_id:None,attempts:0}}
 pub fn own_get_owner(&mut self)->PromiseOrValue<AccountId> {
  if !self.hold{return PromiseOrValue::Value(self.owner.clone());}
  let(p,id)=Promise::new_yield("resolve_owner",b"{}",Gas::from_tgas(3),GasWeight::default());self.yield_id=Some(id);self.attempts+=1;PromiseOrValue::Promise(p)
 }
 pub fn own_get_proposed_owner(&self)->Option<AccountId>{self.proposed.clone()}
 #[payable] pub fn own_propose_owner(&mut self,account_id:Option<AccountId>){near_sdk::assert_one_yocto();require!(env::predecessor_account_id()==self.owner,"Owner only");self.proposed=account_id;}
 #[payable] pub fn own_accept_owner(&mut self){near_sdk::assert_one_yocto();require!(Some(env::predecessor_account_id())==self.proposed,"Proposed only");self.owner=env::predecessor_account_id();self.proposed=None;}
 pub fn set_hold(&mut self,hold:bool){self.hold=hold;}
 pub fn set_price(&mut self,price:String)->PromiseOrValue<String>{
  require!(env::predecessor_account_id()==self.owner,"Owner only");
  match price.as_str(){"fail"=>env::panic_str("Intentional target rejection"),"oversized"=>PromiseOrValue::Value("x".repeat(100_000)),"hold"=>{let(p,id)=Promise::new_yield("resolve_action",b"{}",Gas::from_tgas(3),GasWeight::default());self.yield_id=Some(id);PromiseOrValue::Promise(p)},_=>PromiseOrValue::Value(price)}
 }
 pub fn resume(&mut self){if let Some(id)=self.yield_id.take(){let _=id.resume(b"null".to_vec());}}
 pub fn get_attempts(&self)->u32{self.attempts}
 pub fn invoke(&self,collection:AccountId,method:String,args:Value)->Promise {Promise::new(collection).function_call(method,args.to_string().into_bytes(),near_sdk::NearToken::from_yoctonear(0),Gas::from_tgas(180))}
 pub fn claim_then_delete(&self,collection:AccountId,amount:String,beneficiary:AccountId)->Promise {
  let payment=Promise::new(collection).function_call("withdraw_credit",json!({"amount":amount}).to_string().into_bytes(),near_sdk::NearToken::from_yoctonear(0),Gas::from_tgas(90));
  Promise::new(env::current_account_id()).delete_account(beneficiary);payment
 }
 #[private]pub fn resolve_owner(&mut self)->PromiseOrValue<AccountId>{let(p,id)=Promise::new_yield("resolve_owner_final",b"{}",Gas::from_tgas(2),GasWeight::default());self.yield_id=Some(id);PromiseOrValue::Promise(p)}
 #[private]pub fn resolve_owner_final(&self)->AccountId{self.owner.clone()}
 #[private]pub fn resolve_action(&self)->String{"completed".into()}
 pub fn nft_on_transfer(&self,sender_id:AccountId,previous_owner_id:AccountId,token_id:String,msg:String)->PromiseOrValue<bool>{
  let _=(sender_id,previous_owner_id);if msg=="accept"{return PromiseOrValue::Value(false);}
  if msg=="attack" {return PromiseOrValue::Promise(Promise::new(env::predecessor_account_id()).function_call("execute",json!({"token_id":token_id,"target_method":"set_price","args":{"price":"stolen"},"deposit":"0"}).to_string().into_bytes(),near_sdk::NearToken::from_yoctonear(0),Gas::from_tgas(12)).then(Promise::new(env::current_account_id()).function_call("receiver_result",b"{}".to_vec(),near_sdk::NearToken::from_yoctonear(0),Gas::from_tgas(5))));}
  PromiseOrValue::Value(true)
 }
 #[private]pub fn receiver_result(&self)->bool{require!(env::promise_result_checked(0,1024).is_err(),"Receiver escaped ownership lock");true}
 pub fn balance(&self)->Value{json!(env::account_balance().as_yoctonear().to_string())}
}
