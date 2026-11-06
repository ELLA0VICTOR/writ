use crate::model::{Token,State,utc};
use near_sdk::env;
const FONTS:&str=include_str!("../../../artifacts/media/fonts.css");
fn escape(s:&str)->String{s.replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;").replace('"',"&quot;").replace('\'',"&apos;")}
fn near(amount:u128)->String{let whole=amount/10u128.pow(24);let fraction=format!("{:024}",amount%10u128.pow(24));let fraction=fraction.trim_end_matches('0');if fraction.is_empty(){whole.to_string()}else{format!("{whole}.{fraction}")}}
pub fn render(t:&Token)->String{
 let loan=t.loans.iter().find(|l|l.epoch==t.epoch&&l.expires_at_ms>env::block_timestamp_ms());
 let state=match t.state{State::Listed=>"listed",State::SaleLocked|State::ReceiverLocked=>"locked",_=>if loan.is_some(){"lent"}else{"held"}};
 let svg=match(t.template_id.as_str(),state){
  ("contract-owner","listed")=>include_str!("../../../artifacts/media/contract-owner-listed.svg"),
  ("contract-owner","locked")=>include_str!("../../../artifacts/media/contract-owner-locked.svg"),
  ("contract-owner","lent")=>include_str!("../../../artifacts/media/contract-owner-lent.svg"),
  ("dao-council","listed")=>include_str!("../../../artifacts/media/dao-council-listed.svg"),
  ("dao-council","locked")=>include_str!("../../../artifacts/media/dao-council-locked.svg"),
  ("dao-council","lent")=>include_str!("../../../artifacts/media/dao-council-lent.svg"),
  ("dao-council",_)=>include_str!("../../../artifacts/media/dao-council-held.svg"),
  _=>include_str!("../../../artifacts/media/contract-owner-held.svg")};
 let mut result=svg.replace("__FONTS__",FONTS);
 for (key,value) in [("__ID__",format!("{:0>4}",t.id)),("__COLLECTION__",env::current_account_id().to_string()),("__HOLDER__",t.owner.to_string()),("__TARGET__",t.target.to_string()),("__EPOCH__",t.epoch.to_string()),("__NONCE__",t.nonce.to_string()),("__PRICE__",near(t.price)),("__METHOD__",loan.map(|l|l.method.clone()).unwrap_or_default()),("__EXPIRY__",loan.map(|l|utc(l.expires_at_ms)).unwrap_or_default())]{result=result.replace(key,&escape(&value));}
 // Protocol account names can be 64 characters. Compress long address text to the face's safe width.
 for address in [t.target.as_str(),t.owner.as_str(),env::current_account_id().as_str()]{if address.len()>38{let escaped=escape(address);result=result.replace(&format!(">{escaped}</text>"),&format!(" textLength=\"880\" lengthAdjust=\"spacingAndGlyphs\">{escaped}</text>"));}}
 result
}
