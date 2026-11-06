import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KeyPair} from 'near-api-js';
import {startChain} from '../harness.mjs';

test('failed provisioning credits only returned funding; duplicate mint is rejected', {timeout:120000},async()=>{
 const c=await startChain();try{
  const a=await c.account('alice'),col=await c.deploy('writ','collection','new',{}),target=await c.deploy('target','owner-fixture','new',{owner_id:a.accountId});
  const key=KeyPair.fromRandom('ed25519');await col.createSubAccount({accountOrPrefix:'w1',publicKey:key.getPublicKey(),nearToTransfer:c.nearToYocto('2')});
  const quote=await c.view(col,'get_mint_quote',{template_id:'contract-owner',target:target.accountId});const request=crypto.randomUUID();const args={template_id:'contract-owner',target:target.accountId,client_request_id:request};
  assert.equal(await c.call(a,col,'mint',args,quote.deposit),false);
  assert.equal((await c.view(col,'get_mint_result',{owner_id:a.accountId,client_request_id:request})).status,'failed');
  assert.equal(await c.view(col,'get_credit',{account_id:a.accountId}),quote.executorFunding);
  await assert.rejects(()=>c.call(a,col,'mint',args,quote.deposit));
  assert.equal(await c.call(a,col,'withdraw_credit',{amount:quote.executorFunding}),true);
 }finally{await c.close();}
});

test('failed native payment restores seller credit; it can be withdrawn after account recovery', {timeout:150000},async()=>{
 const c=await startChain();try{
  const a=await c.account('alice'),b=await c.account('bob'),col=await c.deploy('writ','collection','new',{}),target=await c.deploy('target','owner-fixture','new',{owner_id:a.accountId}),seller=await c.deploy('seller','adversary','new',{owner_id:a.accountId});
  let w=await c.mint(a,col,target);await c.call(a,target,'own_propose_owner',{account_id:w.executor},'1');await c.call(a,col,'wrap_step',{token_id:w.id,step:1});await c.call(a,col,'nft_transfer',{token_id:w.id,receiver_id:seller.accountId},'1');w=await c.view(col,'get_writ',{token_id:w.id});
  const price=c.nearToYocto('2').toString();await c.call(a,seller,'invoke',{collection:col.accountId,method:'list',args:{token_id:w.id,price,expected_nonce:w.nonce}});w=await c.view(col,'get_writ',{token_id:w.id});const cfg=await c.view(col,'get_frontend_config');
  assert.equal(await c.call(b,col,'buy',{token_id:w.id,expected_nonce:w.nonce,expected_template_hash:w.templateHash,maximum_price:price,pins:[],client_attempt_id:crypto.randomUUID()},(BigInt(price)+BigInt(cfg.purchase_storage_deposit)).toString()),true);
  await c.call(a,seller,'claim_then_delete',{collection:col.accountId,amount:price,beneficiary:a.accountId});
  await assert.rejects(()=>c.provider.viewAccount({accountId:seller.accountId}));
  assert.equal(await c.view(col,'get_credit',{account_id:seller.accountId}),price);
  const recovered=await c.account('seller');assert.equal(await c.call(recovered,col,'withdraw_credit',{amount:price}),true);assert.equal(await c.view(col,'get_credit',{account_id:seller.accountId}),'0');
  console.log('Confirmed: real failed payment restores the credit exactly once, then pays the recovered account.');
 }finally{await c.close();}
});
