import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startChain} from '../harness.mjs';

async function until(fn,predicate,description){for(let i=0;i<80;i++){const result=await fn();if(predicate(result))return result;await new Promise(r=>setTimeout(r,100));}throw new Error(`Not observed: ${description}`);}
test('hostile target receipts: pending-action locks, oversized success, receiver reentry and late purchase callback', {timeout:180000},async()=>{
 const c=await startChain();try{
  const alice=await c.account('alice'),bob=await c.account('bob');const col=await c.deploy('writ','collection','new',{});
  const hostile=await c.deploy('hostile','adversary','new',{owner_id:alice.accountId});let w=await c.mint(alice,col,hostile);
  await c.call(alice,hostile,'own_propose_owner',{account_id:w.executor},'1');await c.call(alice,col,'wrap_step',{token_id:w.id,step:1});
  const action={token_id:w.id,target_method:'set_price',args:{price:'fail'},deposit:'0'};
  assert.equal(await c.call(alice,col,'execute',action),false);assert.equal((await c.view(col,'get_writ',{token_id:w.id})).pendingCalls,0);
  assert.equal(await c.call(alice,col,'execute',{...action,args:{price:'oversized'}}),true);
  const start=(signer,method,args,deposit='0')=>signer.callFunctionRaw({contractId:col.accountId,methodName:method,args,deposit:BigInt(deposit),gas:300_000_000_000_000n,waitUntil:'INCLUDED_FINAL'});
  await start(alice,'execute',{...action,args:{price:'hold'}});
  await until(()=>c.view(col,'get_writ',{token_id:w.id}),x=>x.pendingCalls===1,'pending role action');
  await assert.rejects(()=>c.call(alice,col,'nft_transfer',{token_id:w.id,receiver_id:bob.accountId},'1'));
  w=await c.view(col,'get_writ',{token_id:w.id});await assert.rejects(()=>c.call(alice,col,'list',{token_id:w.id,price:'1',expected_nonce:w.nonce}));
  await c.call(alice,hostile,'resume');await until(()=>c.view(col,'get_writ',{token_id:w.id}),x=>x.pendingCalls===0,'action completion');
  // The temporary receiver owns the NFT during the call, but may not exercise it before resolution.
  assert.equal(await c.call(alice,col,'nft_transfer_call',{token_id:w.id,receiver_id:hostile.accountId,msg:'attack'},'1'),false);
  assert.equal((await c.view(col,'get_writ',{token_id:w.id})).owner,alice.accountId);
  w=await c.view(col,'get_writ',{token_id:w.id});const price=c.nearToYocto('1').toString();await c.call(alice,col,'list',{token_id:w.id,price,expected_nonce:w.nonce});
  w=await c.view(col,'get_writ',{token_id:w.id});await c.call(alice,hostile,'set_hold',{hold:true});const config=await c.view(col,'get_frontend_config');const attempt=crypto.randomUUID();
  const lookup={token_id:w.id,buyer_id:bob.accountId,client_attempt_id:attempt};
  await start(bob,'buy',{token_id:w.id,expected_nonce:w.nonce,expected_template_hash:w.templateHash,maximum_price:price,pins:[],client_attempt_id:attempt},(BigInt(price)+BigInt(config.purchase_storage_deposit)).toString());
  await until(()=>c.view(hostile,'get_attempts'),x=>x===1,'yielded owner check');
  await assert.rejects(()=>c.call(bob,col,'release_stuck',lookup));
  await assert.rejects(()=>c.call(alice,col,'unlist',{token_id:w.id}));
  await c.provider.sendJsonRpc('sandbox_fast_forward',{delta_height:210});
  assert.equal((await c.view(col,'get_purchase',lookup)).status,'releasable');
  await c.call(alice,col,'release_stuck',lookup); // Permissionless, still pays only Bob.
  assert.equal(await c.call(bob,col,'claim_refund',lookup),true);
  await c.provider.sendJsonRpc('sandbox_fast_forward',{delta_height:450});
  await c.call(alice,hostile,'resume');
  await new Promise(r=>setTimeout(r,1000));
  const terminal=await c.view(col,'get_purchase',lookup);assert.equal(terminal.status,'released');assert.equal(terminal.refundStatus,'paid');
  assert.equal((await c.view(col,'get_writ',{token_id:w.id})).owner,alice.accountId);assert.equal(await c.view(col,'get_credit',{account_id:alice.accountId}),'0');
  await assert.rejects(()=>c.call(bob,col,'claim_refund',lookup));
  console.log('Confirmed: unknown action stays locked; large return does not fake failure; receiver cannot act; release invalidates late callbacks before refund.');
 }finally{await c.close();}
});
