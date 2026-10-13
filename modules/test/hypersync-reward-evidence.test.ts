import { describe, it, expect, vi } from 'vitest';
import { verifyHyperSyncReward, type IndexedReward } from '../hypersync-reward-evidence';
import { transferData } from '../native-transfer';
const sender = '0x1111111111111111111111111111111111111111';
const receiver = '0x2222222222222222222222222222222222222222';
const hash = '0x' + 'ab'.repeat(32);
const blockHash = '0x' + 'cd'.repeat(32);
const base: IndexedReward = { signature: hash, chainId: 143, senderAddress: sender, recipientAddress: receiver,
  amountRaw: 100000000000001n, evmNonce: 8n, blockNumber: 123, blockHash };
function fixture(reward: IndexedReward) {
  return { next_block: 124, data: {
    blocks: [{ number: 123, hash: blockHash }],
    transactions: [{ hash, from: sender, to: reward.tokenAddress ?? receiver, value: reward.tokenAddress ? '0x0' : '0x' + reward.amountRaw.toString(16),
      status: 1, input: transferData(reward), nonce: 8, block_number: 123, block_hash: blockHash }],
    logs: reward.tokenAddress ? [{ transaction_hash: hash, block_number: 123, block_hash: blockHash, log_index: 7, removed: false,
      address: reward.tokenAddress, topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      topic1: '0x' + sender.slice(2).padStart(64,'0'), topic2: '0x' + receiver.slice(2).padStart(64,'0'),
      data: '0x' + reward.amountRaw.toString(16).padStart(64,'0') }] : [],
  } };
}
function request(body: unknown) { return vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)); }
describe.each(['MON', 'CHOG'])('%s indexed reward', asset => {
  const reward = { ...base, ...(asset === 'CHOG' ? { tokenAddress: '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777' as const } : {}) };
  it('verifies exact units and queries only the finalized block', async () => {
    const fetch = request(fixture(reward));
    expect(await verifyHyperSyncReward(reward, 'token', fetch)).toBe('verified');
    const query = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(query.from_block).toBe(123); expect(query.to_block).toBe(124);
    expect(query.transactions[0].to).toEqual([reward.tokenAddress ?? receiver]);
  });
  it.each(['from','to','value','input','status','nonce','block_hash','block_number'])('rejects altered %s', async field => {
    const body = fixture(reward); (body.data.transactions[0] as Record<string,unknown>)[field] = '0x9999';
    expect(await verifyHyperSyncReward(reward,'token',request(body))).toBe('mismatch');
  });
  it('rejects a reorg and duplicate transaction rows', async () => {
    const body = fixture(reward); body.data.blocks[0].hash = hash;
    expect(await verifyHyperSyncReward(reward,'token',request(body))).toBe('mismatch');
    const duplicate = fixture(reward); duplicate.data.transactions.push(duplicate.data.transactions[0]);
    expect(await verifyHyperSyncReward(reward,'token',request(duplicate))).toBe('mismatch');
  });
  it('keeps index lag and absent transaction unverified', async () => {
    const body = fixture(reward); body.next_block = 123;
    expect(await verifyHyperSyncReward(reward,'token',request(body))).toBe('pending');
    body.next_block = 124; body.data.transactions = [];
    expect(await verifyHyperSyncReward(reward,'token',request(body))).toBe('pending');
  });
});
it.each(['topic1','topic2','data','removed','block_hash'])('rejects altered CHOG log %s', async field => {
  const reward = { ...base, tokenAddress: '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777' as const };
  const body = fixture(reward); (body.data.logs[0] as Record<string,unknown>)[field] = field === 'removed' ? true : '0x1234';
  expect(await verifyHyperSyncReward(reward,'token',request(body))).toBe('mismatch');
});
it('does not double count duplicate CHOG events', async () => {
  const reward = { ...base, tokenAddress: '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777' as const };
  const body = fixture(reward); body.data.logs.push(body.data.logs[0]);
  expect(await verifyHyperSyncReward(reward,'token',request(body))).toBe('mismatch');
});
it('does not send requests without configuration or for unsupported assets/chains', async () => {
  const fetch = request({});
  expect(await verifyHyperSyncReward(base,undefined,fetch)).toBe('not_configured');
  expect(await verifyHyperSyncReward({...base, chainId:10143},'token',fetch)).toBe('unsupported');
  expect(await verifyHyperSyncReward({...base, tokenAddress:sender},'token',fetch)).toBe('unsupported');
  expect(fetch).not.toHaveBeenCalled();
});
it('fails closed on provider failure, malformed JSON and malformed rows', async () => {
  for (const body of [{}, {next_block:124,data:{blocks:null}}, {next_block:124,data:{blocks:[null]}}])
    expect(await verifyHyperSyncReward(base,'token',request(body))).toBe('unavailable');
  expect(await verifyHyperSyncReward(base,'token',vi.fn<typeof fetch>().mockRejectedValue(Error('timeout')))).toBe('unavailable');
  expect(await verifyHyperSyncReward(base,'token',vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:401})))).toBe('unavailable');
});

it.each(['MON','CHOG'])('accepts live JSON response batches for %s', async asset => {
 const reward = {...base, ...(asset === 'CHOG' ? {tokenAddress:'0x350035555E10d9AfAF1566AaebfCeD5BA6C27777' as const} : {})};
 const body=fixture(reward);
 const {logs,...withoutLogs}=body.data;
 expect(await verifyHyperSyncReward(reward,'token',request({...body,data:asset==='CHOG' ? [withoutLogs,{logs}] : [withoutLogs]}))).toBe('verified');
});
