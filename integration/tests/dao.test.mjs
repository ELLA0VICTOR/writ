import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startChain} from '../harness.mjs';

test('unchanged upstream Sputnik DAO: wrap a seat, vote through it, transfer and revoke membership', {timeout:180000},async()=>{
 const c=await startChain();try{
  const alice=await c.account('alice'),bob=await c.account('bob');
  const col=await c.deploy('writ','collection','new',{});
  const dao=await c.deploy('dao','vendor/sputnikdao2','new',{config:{name:'Writ council',purpose:'Sandbox integration',metadata:''},policy:[alice.accountId]});
  const w=await c.mint(alice,col,dao,'dao-council');
  const bond=(await c.view(dao,'get_policy')).proposal_bond;
  const add=await c.call(alice,dao,'add_proposal',{proposal:{description:'Seat held by keyless Writ executor',kind:{AddMemberToRole:{member_id:w.executor,role:'council'}}}},bond);
  await c.call(alice,dao,'act_proposal',{id:add,action:'VoteApprove'});
  assert.equal(await c.call(alice,col,'confirm_wrap',{token_id:w.id}),true);
  const proposal=await c.call(alice,dao,'add_proposal',{proposal:{description:'Transferable seat vote',kind:'Vote'}},bond);
  assert.equal(await c.call(alice,col,'execute',{token_id:w.id,target_method:'act_proposal',args:{id:proposal,action:'VoteApprove'},deposit:'0'}),true);
  let actual=await c.view(dao,'get_proposal',{id:proposal});assert.equal(actual.votes[w.executor],'Approve');
  await c.call(alice,col,'nft_transfer',{token_id:w.id,receiver_id:bob.accountId},'1');
  const p2=await c.call(alice,dao,'add_proposal',{proposal:{description:'New NFT holder voting',kind:'Vote'}},bond);
  const vote={token_id:w.id,target_method:'act_proposal',args:{id:p2,action:'VoteApprove'},deposit:'0'};
  await assert.rejects(()=>c.call(alice,col,'execute',vote));assert.equal(await c.call(bob,col,'execute',vote),true);
  const remove=await c.call(alice,dao,'add_proposal',{proposal:{description:'DAO remains sovereign',kind:{RemoveMemberFromRole:{member_id:w.executor,role:'council'}}}},bond);
  await c.call(alice,dao,'act_proposal',{id:remove,action:'VoteApprove'});
  await c.call(bob,col,'execute',{...vote,args:{id:remove,action:'VoteApprove'}});
  assert.equal(await c.call(bob,col,'confirm_wrap',{token_id:w.id}),false);
  const keys=await c.provider.sendJsonRpc('query',{request_type:'view_access_key_list',account_id:w.executor,finality:'final'});assert.deepEqual(keys.keys,[]);
  console.log('Confirmed: real unmodified Sputnik membership and votes; control follows NFT; DAO can revoke the seat.');
 }finally{await c.close();}
});
