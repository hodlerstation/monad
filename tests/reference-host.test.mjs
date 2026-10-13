import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm, readFile, writeFile, cp, symlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import solc from 'solc';
import { createTestIndexer } from 'envio';
import { ReferenceHost } from '../modules/reference-host/host.mjs';
import { serveReferenceHost } from '../modules/reference-host/api.mjs';
import { EnvioMissionEventSource } from '../modules/envio-mission-event-source.ts';
const require=createRequire(new URL('../modules/package.json',import.meta.url));
const {createPublicClient,createWalletClient,http,defineChain,decodeEventLog,parseAbi}=require('viem');
const {privateKeyToAccount,generatePrivateKey}=require('viem/accounts');

test('public reference: signed login → admin mission → join → real local Trade → Envio handler → Claim', {timeout:120000}, async()=>{
  const reservation=createNetServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const rpcUrl=`http://127.0.0.1:${port}`;
  const anvil=spawn(process.execPath,[new URL('../node_modules/@foundry-rs/anvil/bin.mjs',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),'--host','127.0.0.1','--port',String(port),'--chain-id','143','--silent'],{stdio:'ignore',windowsHide:true});
  const folder=await mkdtemp(join(tmpdir(),'hodler-reference-'));
  const originalCwd=process.cwd();
  let host,api,gateway;
  try {
    const chain=defineChain({id:143,name:'Local Anvil ONLY',nativeCurrency:{name:'Local MON',symbol:'MON',decimals:18},rpcUrls:{default:{http:[rpcUrl]}}});
    const rpc=createPublicClient({chain,transport:http(rpcUrl,{timeout:2000,retryCount:0})});
    let ready=false;for(let i=0;i<100;i++){try{await rpc.getChainId();ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
    assert.ok(ready,'Anvil starts locally');
    const admin=privateKeyToAccount(generatePrivateKey()), participant=privateKeyToAccount(generatePrivateKey()), attacker=privateKeyToAccount(generatePrivateKey());
    for(const account of [admin,participant]) await rpc.request({method:'anvil_setBalance',params:[account.address,'0x8ac7230489e80000']});
    const adminWallet=createWalletClient({account:admin,chain,transport:http(rpcUrl)}), wallet=createWalletClient({account:participant,chain,transport:http(rpcUrl)});
    const source='pragma solidity ^0.8.20; contract Market {event Trade(address indexed account,uint256 indexed id,bool buy,uint256 quantity,uint256 amount,uint256 total); function buy(uint256 id) external {emit Trade(msg.sender,id,true,1,1,1);} }';
    const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'Market.sol':{content:source}},settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}))).contracts['Market.sol'].Market;
    const deployed=await rpc.waitForTransactionReceipt({hash:await adminWallet.deployContract({abi:compiled.abi,bytecode:'0x'+compiled.evm.bytecode.object})});
    // Keep the configured contract address so the real handler's address filter applies.
    // Only this fresh local chain receives the minimal test contract runtime.
    const contract='0x43dd6ba111b09e2ee318666b82ea279dd290ba89';
    await rpc.request({method:'anvil_setCode',params:[contract,await rpc.getCode({address:deployed.contractAddress})]});
    // Load an isolated local-start config; never alter the production config on disk.
    const root=fileURLToPath(new URL('../',import.meta.url));
    const config=(await readFile(join(root,'config.yaml'),'utf8')).replace('start_block: 111647728','start_block: 0');
    await writeFile(join(folder,'config.yaml'),config);
    await writeFile(join(folder,'schema.graphql'),await readFile(join(root,'schema.graphql')));
    await cp(join(root,'src'),join(folder,'src'),{recursive:true});
    await symlink(join(root,'node_modules'),join(folder,'node_modules'),'junction');
    process.chdir(folder);
    const indexer=createTestIndexer();
    gateway=createServer(async(req,res)=>{try{let raw='';for await(const c of req)raw+=c;const {variables}=JSON.parse(raw);const row=await indexer.MissionTrade.get(variables.id);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{MissionTrade:row?[row]:[]}}));}catch{res.statusCode=500;res.end('{}');}});
    await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
    const events=new EnvioMissionEventSource(`http://127.0.0.1:${gateway.address().port}`,undefined,[{chainId:143,contract}]);
    const db=join(folder,'state.sqlite');
    const options={rpc,rpcUrl,signer:admin,source:events,contract,database:db};
    host=new ReferenceHost(options);await host.local();api=await serveReferenceHost(host);
    const call=async(path,body,token)=>{const response=await fetch(api.url+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return response.json();};
    const login=async(account)=>{const challenge=await call('/challenge',{address:account.address});const signature=await account.signMessage({message:challenge.message});return call('/login',{id:challenge.id,signature});};
    const adminSession=await login(admin), user=await login(participant);
    assert.ok(user.token);assert.ok(adminSession.token);
    const challenge=await call('/challenge',{address:participant.address});
    assert.equal((await call('/login',{id:challenge.id,signature:await attacker.signMessage({message:challenge.message})})).error,'INVALID_SIGNATURE');
    const sig=await participant.signMessage({message:challenge.message});
    const duplicateLogins=await Promise.all([call('/login',{id:challenge.id,signature:sig}),call('/login',{id:challenge.id,signature:sig})]);
    assert.equal(duplicateLogins.filter(x=>x.token).length,1);
    assert.equal((await call('/missions',{reward:'100000000000000',capacity:1,tokenId:'7'},user.token)).error,'ADMIN_REQUIRED');
    const mission=await call('/missions',{reward:'100000000000000',capacity:1,tokenId:'7'},adminSession.token);assert.ok(mission.id);
    assert.equal((await call('/claim',{id:mission.id},user.token)).error,'APPROVAL_REQUIRED');
    assert.equal((await call('/join',{id:mission.id})).error,'UNAUTHENTICATED');
    assert.equal((await call('/join',{id:mission.id},user.token)).joined,true);
    assert.equal((await call('/join',{id:mission.id},adminSession.token)).error,'MISSION_FULL');
    const hash=await wallet.writeContract({address:contract,abi:compiled.abi,functionName:'buy',args:[7n]});
    const receipt=await rpc.waitForTransactionReceipt({hash});
    // Anvil's finalized tag trails its head; advance only the disposable local chain.
    await rpc.request({method:'anvil_mine',params:['0x40']});
    assert.equal((await call('/complete',{id:mission.id,hash},user.token)).error,'INDEXING_PENDING');
    const block=await rpc.getBlock({blockNumber:receipt.blockNumber});
    const log=receipt.logs[0];const args=decodeEventLog({abi:parseAbi(['event Trade(address indexed account,uint256 indexed id,bool buy,uint256 quantity,uint256 amount,uint256 total)']),data:log.data,topics:log.topics}).args;
    await indexer.process({chains:{143:{simulate:[{contract:'ChogWearables',event:'Trade',srcAddress:contract,logIndex:log.logIndex,transaction:{hash},block:{number:Number(block.number),hash:block.hash},params:args}]}}});
    assert.equal((await call('/complete',{id:mission.id,hash},user.token)).approved,true);
    const before=await rpc.getBalance({address:participant.address});
    let claims=await Promise.all([call('/claim',{id:mission.id},user.token),call('/claim',{id:mission.id},user.token)]);
    await rpc.request({method:'anvil_mine',params:['0x40']});
    for(let i=0;i<10 && !claims.some(x=>x.state==='FINALIZED');i++) {await new Promise(r=>setTimeout(r,100));claims.push(await call('/claim',{id:mission.id},user.token));}
    assert.ok(claims.some(x=>x.state==='FINALIZED'),JSON.stringify(claims));
    assert.equal(new Set(claims.map(x=>x.hash)).size,1);
    assert.equal(await rpc.getBalance({address:participant.address})-before,100000000000000n);
    const paymentHash=claims[0].hash;
    await api.close();api=null;host.close();host=new ReferenceHost(options);api=await serveReferenceHost(host);
    const replay=await call('/claim',{id:mission.id},user.token);
    assert.equal(replay.hash,paymentHash);assert.equal(replay.idempotent,true);
    assert.equal(await rpc.getBalance({address:participant.address})-before,100000000000000n);
    console.log(JSON.stringify({mode:'LOCAL_ANVIL_WITH_REAL_ENVIO_HANDLER_SIMULATOR',login:true,mission:true,join:true,indexRequired:true,claim:'FINALIZED',exactLocalReward:'0.0001',restartIdempotency:true,publicFundsUsed:false}));
  }finally{process.chdir(originalCwd);if(api)await api.close();host?.close();if(gateway)await new Promise(r=>gateway.close(r));anvil.kill();if(dirname(resolve(folder))!==resolve(tmpdir()) || !basename(folder).startsWith('hodler-reference-'))throw new Error('UNSAFE_CLEANUP_PATH');await rm(folder,{recursive:true,force:true});}
});
