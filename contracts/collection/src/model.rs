use near_sdk::{near, AccountId};
use near_sdk::json_types::U128;
use near_sdk::serde_json::Value;

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
pub enum State { Creating, Idle, Listed, SaleLocked, ReceiverLocked, Unwrapping, Retired }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Loan {
    pub id: String, pub borrower: AccountId, pub method: String, pub args_json: String,
    pub expires_at_ms: u64, pub epoch: u64,
}
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct History {
    pub id: String, pub at: String, pub event: String, pub actor: AccountId,
    pub detail: String, pub refused: bool,
}
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Token {
    pub id: String, pub owner: AccountId, pub target: AccountId, pub executor: AccountId,
    pub template_id: String, pub template_hash: String, pub state: State, pub executor_ready: bool, pub wrapped: bool,
    pub nonce: u64, pub epoch: u64, pub pending: u32, pub price: u128,
    pub loans: Vec<Loan>, pub history: Vec<History>, pub lock: Option<String>,
}
#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
#[derive(Clone)]
pub struct Check {
    pub id: String, pub label: String, pub method: String, pub target: String,
    pub pointer: String, pub operator: String, pub expected: Value,
    #[serde(default)] pub group_name: Option<String>,
}
#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
#[derive(Clone)]
pub struct Action {
    pub method: String, pub label: String, pub args: Value,
    pub max_deposit: U128, pub lendable: bool,
}
#[near(serializers = [json])]
#[serde(rename_all = "camelCase")]
#[derive(Clone)]
pub struct Template {
    pub id: String, pub name: String, pub checks: Vec<Check>, pub actions: Vec<Action>,
    pub supports_unwrap: bool,
}
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Evidence {
    pub id: String, pub label: String, pub method: String, pub actual_json: String,
    pub expected_json: String, pub result: String, pub block: u64, pub at: u64,
}
#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq)]
pub enum PurchaseStatus { Checking, Refused, Settled, Released }
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Purchase {
    pub key: String, pub client_id: String, pub token_id: String,
    pub buyer: AccountId, pub seller: AccountId, pub amount: u128,
    pub expected_nonce: u64, pub status: PurchaseStatus, pub started: u64, pub deadline: u64,
    pub checks: Vec<Evidence>, pub pins: Vec<Pin>, pub ended_loans: Vec<String>,
    pub refund_paid: bool, pub refund_pending: bool,
}
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Pin { pub id: String, pub value: U128 }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct CreditTransfer { pub account: AccountId, pub amount: u128, pub purchase: Option<String> }

pub fn utc(ms: u64) -> String {
    let seconds = ms / 1000;
    let z = (seconds / 86400) as i64 + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let mut y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    y += if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{:03}Z", seconds / 3600 % 24, seconds / 60 % 60, seconds % 60, ms % 1000)
}

pub fn resolve(value: &Value, executor: &AccountId) -> Value {
    match value {
        Value::String(s) if s == "$WRIT" => Value::String(executor.to_string()),
        Value::Array(a) => Value::Array(a.iter().map(|v| resolve(v, executor)).collect()),
        Value::Object(o) => Value::Object(o.iter().map(|(k,v)| (k.clone(),resolve(v,executor))).collect()),
        other => other.clone(),
    }
}
