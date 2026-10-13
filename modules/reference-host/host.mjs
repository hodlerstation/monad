import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { decodeEventLog, keccak256, parseAbi, verifyMessage } from 'viem';
import { nativeTransferStatus, signNativeTransfer } from '../native-transfer.ts';

const tradeAbi = parseAbi(['event Trade(address indexed account,uint256 indexed id,bool buy,uint256 quantity,uint256 amount,uint256 total)']);
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

/** Complete standalone reference lifecycle. Local funds only; not the private product backend. */
export class ReferenceHost {
  constructor({ rpc, rpcUrl, signer, source, contract, database = ':memory:' }) {
    const url = new URL(rpcUrl);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password)
      throw new Error('LOCAL_RPC_REQUIRED');
    this.rpc = rpc; this.signer = signer; this.source = source; this.contract = contract.toLowerCase();
    this.db = new DatabaseSync(database);
    this.db.exec(`CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY, address TEXT, message TEXT, expires INTEGER);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, address TEXT, expires INTEGER);
      CREATE TABLE IF NOT EXISTS missions(id TEXT PRIMARY KEY, reward TEXT, capacity INTEGER, token TEXT);
      CREATE TABLE IF NOT EXISTS joins(mission TEXT, address TEXT, after_block TEXT, evidence TEXT, payout TEXT, PRIMARY KEY(mission,address));
      CREATE UNIQUE INDEX IF NOT EXISTS proof_once ON joins(evidence) WHERE evidence IS NOT NULL;`);
    this.queue = Promise.resolve();
  }
  async local() {
    if (await this.rpc.getChainId() !== 143 || !(await this.rpc.request({method:'web3_clientVersion'})).toLowerCase().includes('anvil'))
      throw new Error('LOCAL_ANVIL_REQUIRED');
    // Anvil must not be a mainnet fork. Its zero-height genesis has a local timestamp.
    const info = await this.rpc.request({method:'anvil_nodeInfo'});
    if (info.forkConfig?.forkUrl || info.forkConfig?.forkBlockNumber != null) throw new Error('FORK_NOT_ALLOWED');
  }
  challenge(address) {
    if (!addressPattern.test(address)) throw new Error('INVALID_ADDRESS');
    address = address.toLowerCase();
    this.db.prepare('DELETE FROM challenges WHERE expires < ?').run(Date.now());
    const id = randomUUID(), expires = Date.now() + 300000;
    const message = `HodlerStation LOCAL reference host login\nAudience: loopback reference-host\nAddress: ${address}\nNonce: ${id}\nExpires: ${expires}\nLocal development assets only. Not a production login.`;
    this.db.prepare('INSERT INTO challenges VALUES(?,?,?,?)').run(id,address,message,expires);
    return {id,message};
  }
  async login(id, signature) {
    const c = this.db.prepare('SELECT * FROM challenges WHERE id=?').get(id);
    if (!c || c.expires < Date.now()) throw new Error('CHALLENGE_EXPIRED');
    if (!await verifyMessage({address:c.address,message:c.message,signature})) throw new Error('INVALID_SIGNATURE');
    // Consume atomically after the asynchronous signature check: only one concurrent caller wins.
    if (this.db.prepare('DELETE FROM challenges WHERE id=?').run(id).changes !== 1) throw new Error('CHALLENGE_USED');
    const token = randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,c.address,Date.now()+3600000);
    return {token,address:c.address};
  }
  user(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw new Error('UNAUTHENTICATED');
    const row = this.db.prepare('SELECT * FROM sessions WHERE id=?').get(token);
    if (!row || row.expires < Date.now()) throw new Error('UNAUTHENTICATED');
    return row.address;
  }
  async create(token, {reward,capacity,tokenId}) {
    if (this.user(token) !== this.signer.address.toLowerCase()) throw new Error('ADMIN_REQUIRED');
    if (!/^[1-9][0-9]{0,14}$/.test(reward) || BigInt(reward)>100000000000000n || !Number.isInteger(capacity) || capacity<1 || capacity>10 || !/^(0|[1-9][0-9]{0,77})$/.test(tokenId) || BigInt(tokenId)>=2n**256n)
      throw new Error('INVALID_MISSION');
    const id = randomUUID();
    this.db.prepare('INSERT INTO missions VALUES(?,?,?,?)').run(id,reward,capacity,tokenId);
    return {id,reward,capacity,tokenId};
  }
  async join(token,id) {
    const address=this.user(token);
    const mission=this.db.prepare('SELECT * FROM missions WHERE id=?').get(id);
    if (!mission) throw new Error('MISSION_NOT_FOUND');
    if (this.db.prepare('SELECT 1 FROM joins WHERE mission=? AND address=?').get(id,address)) return {joined:true};
    const block=await this.rpc.getBlockNumber();
    const tx=this.db.prepare('INSERT OR IGNORE INTO joins(mission,address,after_block) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM joins WHERE mission=?) < ?');
    if (tx.run(id,address,String(block),id,mission.capacity).changes!==1) throw new Error('MISSION_FULL');
    return {joined:true};
  }
  async complete(token,id,hash) {
    const address=this.user(token);
    const join=this.db.prepare('SELECT * FROM joins WHERE mission=? AND address=?').get(id,address);
    if (!join) throw new Error('JOIN_REQUIRED');
    if (join.evidence) return {approved:true};
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('INVALID_HASH');
    const mission=this.db.prepare('SELECT * FROM missions WHERE id=?').get(id);
    const [receipt,tx]=await Promise.all([this.rpc.getTransactionReceipt({hash}),this.rpc.getTransaction({hash})]);
    const [block,finalized]=await Promise.all([this.rpc.getBlock({blockNumber:receipt.blockNumber}),this.rpc.getBlock({blockTag:'finalized'})]);
    if (receipt.status!=='success' || tx.from.toLowerCase()!==address || tx.to?.toLowerCase()!==this.contract || receipt.blockNumber<=BigInt(join.after_block) || receipt.blockNumber>finalized.number || block.hash!==receipt.blockHash || tx.blockHash!==block.hash || tx.chainId!==143)
      throw new Error('INVALID_PROOF');
    for (const log of receipt.logs) {
      if(log.removed || log.address.toLowerCase()!==this.contract || log.blockHash!==block.hash || log.transactionHash!==hash) continue;
      let args;try {args=decodeEventLog({abi:tradeAbi,data:log.data,topics:log.topics}).args;} catch {continue;}
      if(args.account.toLowerCase()!==address || !args.buy || args.quantity<=0n || String(args.id)!==mission.token) continue;
      const event={chainId:143,contract:this.contract,transactionHash:hash.toLowerCase(),blockHash:block.hash.toLowerCase(),blockNumber:String(block.number),logIndex:log.logIndex,account:address,tokenId:String(args.id),buy:true,quantity:String(args.quantity)};
      if (!await this.source.indexed(event)) throw new Error('INDEXING_PENDING');
      const evidence=`143_${hash.toLowerCase()}_${log.logIndex}`;
      const changed=this.db.prepare('UPDATE joins SET evidence=? WHERE mission=? AND address=? AND evidence IS NULL').run(evidence,id,address);
      if(changed.changes!==1) throw new Error('PROOF_ALREADY_USED');
      return {approved:true,evidence};
    }
    throw new Error('INVALID_PROOF');
  }
  claim(token,id) {
    const address=this.user(token);
    const task=()=>this.pay(address,id);
    const work=this.queue.then(task,task);this.queue=work.catch(()=>{});return work;
  }
  async pay(address,id) {
    await this.local();
    const row=this.db.prepare('SELECT * FROM joins WHERE mission=? AND address=?').get(id,address);
    if(!row?.evidence) throw new Error('APPROVAL_REQUIRED');
    const mission=this.db.prepare('SELECT * FROM missions WHERE id=?').get(id);
    let payment=row.payout ? JSON.parse(row.payout) : null;
    if(!payment) {
      if(this.db.prepare('SELECT payout FROM joins WHERE payout IS NOT NULL').all().some(x=>JSON.parse(x.payout).state!=='FINALIZED')) throw new Error('PENDING_PAYOUT');
      const nonce=await this.rpc.getTransactionCount({address:this.signer.address,blockTag:'pending'});
      const fees=await this.rpc.estimateFeesPerGas();
      const raw=await signNativeTransfer(this.signer,{chainId:143,nonce,to:address,value:BigInt(mission.reward),gas:21000n,...fees});
      payment={raw,hash:keccak256(raw),nonce,state:'PENDING'};
      // Persist exact signed bytes BEFORE broadcast; retries retain their nonce and hash.
      this.db.prepare('UPDATE joins SET payout=? WHERE mission=? AND address=?').run(JSON.stringify(payment),id,address);
    }
    if(payment.state==='FINALIZED') return {hash:payment.hash,state:payment.state,idempotent:true};
    try {await this.rpc.sendRawTransaction({serializedTransaction:payment.raw});} catch { /* resolve only through receipt */ }
    const state=await nativeTransferStatus(this.rpc,{signature:payment.hash,chainId:143,senderAddress:this.signer.address.toLowerCase(),recipientAddress:address,amountRaw:BigInt(mission.reward),evmNonce:BigInt(payment.nonce)},143);
    payment.state=state;
    this.db.prepare('UPDATE joins SET payout=? WHERE mission=? AND address=?').run(JSON.stringify(payment),id,address);
    return {hash:payment.hash,state,idempotent:false};
  }
  close(){this.db.close();}
}
