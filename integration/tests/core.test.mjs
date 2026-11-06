import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startChain} from '../harness.mjs';

test('real NEAR: wrap owner role, transfer the NFT, reject the previous holder', {timeout:180000}, async()=>{
  const chain=await startChain();
  try {
    const alice=await chain.account('alice');const bob=await chain.account('bob');
    const collection=await chain.deploy('writ','collection','new',{});
    const target=await chain.deploy('lanterns','owner-fixture','new',{owner_id:alice.accountId});
    const writ=await chain.mint(alice,collection,target);
    const keys=await chain.provider.sendJsonRpc('query',{request_type:'view_access_key_list',account_id:writ.executor,finality:'final'});
    assert.deepEqual(keys.keys,[]);
    await chain.call(alice,target,'own_propose_owner',{account_id:writ.executor},'1');
    assert.equal(await chain.call(alice,collection,'wrap_step',{token_id:writ.id,step:1}),true);
    assert.equal(await chain.view(target,'own_get_owner'),writ.executor);
    const action={token_id:writ.id,target_method:'set_price',args:{price:'7'},deposit:'0'};
    assert.equal(await chain.call(alice,collection,'execute',action),true);
    assert.equal(await chain.view(target,'get_price'),'7');
    await chain.call(alice,collection,'nft_transfer',{token_id:writ.id,receiver_id:bob.accountId},'1');
    assert.equal((await chain.view(collection,'nft_token',{token_id:writ.id})).owner_id,bob.accountId);
    await assert.rejects(()=>chain.call(alice,collection,'execute',action));
    await assert.rejects(()=>chain.call(alice,writ.executor,'execute',{method:'set_price',args:{price:'99'}}));
    assert.equal(await chain.call(bob,collection,'execute',{...action,args:{price:'8'}}),true);
    assert.equal(await chain.view(target,'get_price'),'8');
    const history=await chain.view(collection,'get_history',{token_id:writ.id});
    assert(history.entries.some(entry=>entry.event==='NFT transferred'));
    assert(history.entries.every(entry=>Number.isFinite(Date.parse(entry.at))));
    console.log('Confirmed: keyless executor, upstream Owner handover, direct NFT transfer, old-holder rejection.');
  } finally {await chain.close();}
});
