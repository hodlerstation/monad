import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem';
import evidence from '../../submission/evidence.json';
const rpc = vi.hoisted(() => ({ getChainId: vi.fn(), getTransactionReceipt: vi.fn(), getBlock: vi.fn(), getTransaction: vi.fn() }));
vi.mock('viem', async importOriginal => ({ ...await importOriginal<typeof import('viem')>(), createPublicClient: () => rpc }));
import { verifyRecordedEvidence } from '../demo/verify';
const e = evidence.indexer.event;
let receipt: any;
beforeEach(() => {
  vi.resetAllMocks();
  rpc.getChainId.mockResolvedValue(143);
  receipt = { status: 'success', blockHash: e.blockHash, blockNumber: BigInt(e.blockNumber), logs: [{
    logIndex: e.logIndex, removed: false, address: e.contract, blockHash: e.blockHash, transactionHash: e.transactionHash,
    topics: encodeEventTopics({ abi: parseAbi(['event Trade(address indexed account,uint256 indexed id,bool buy,uint256 quantity,uint256 amount,uint256 total)']), eventName: 'Trade', args: { account: e.account as `0x${string}`, id: BigInt(e.tokenId) } }),
    data: encodeAbiParameters([{type:'bool'},{type:'uint256'},{type:'uint256'},{type:'uint256'}], [true,1n,1n,1n]),
  }] };
  rpc.getTransactionReceipt.mockImplementation(async ({hash}) => hash === evidence.trade.hash ? receipt : {status:'success', blockHash:e.blockHash, blockNumber:BigInt(evidence.payout.blockNumber)});
  rpc.getBlock.mockResolvedValue({hash:e.blockHash,number:200000000n});
  rpc.getTransaction.mockImplementation(async ({hash}) => hash === evidence.trade.hash ? {from:e.account,to:e.contract} : {from:evidence.payout.from,to:e.account,value:BigInt(evidence.payout.value)});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{MissionTrade:[e]}})}));
});
afterEach(() => vi.unstubAllGlobals());
it('replays evidence without authorizing a new claim', async () => {
  expect(await verifyRecordedEvidence()).toMatchObject({indexed:true,newClaimAuthorized:false,payoutWei:evidence.payout.value});
});
it('rejects the wrong RPC chain', async () => {rpc.getChainId.mockResolvedValue(1);await expect(verifyRecordedEvidence()).rejects.toThrow('Wrong RPC chain');expect(fetch).not.toHaveBeenCalled();});
it('rejects a reverted trade before consulting Envio', async () => {receipt.status='reverted';await expect(verifyRecordedEvidence()).rejects.toThrow('Canonical');expect(fetch).not.toHaveBeenCalled();});
it('rejects an orphaned block', async () => {rpc.getBlock.mockResolvedValue({hash:'0x00',number:200000000n});await expect(verifyRecordedEvidence()).rejects.toThrow('Canonical');});
it('rejects altered event quantity', async () => {receipt.logs[0].data=encodeAbiParameters([{type:'bool'},{type:'uint256'},{type:'uint256'},{type:'uint256'}],[true,2n,1n,1n]);await expect(verifyRecordedEvidence()).rejects.toThrow('Trade fields');});
it('keeps missing indexing pending', async () => {vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({data:{MissionTrade:[]}})} as Response);await expect(verifyRecordedEvidence()).rejects.toThrow('pending');});
it('fails closed on Envio rate limiting', async () => {vi.mocked(fetch).mockResolvedValue({ok:false,status:429} as Response);await expect(verifyRecordedEvidence()).rejects.toThrow('ENVIO_RATE_LIMITED');});
it('rejects a wrong payout amount', async () => {rpc.getTransaction.mockResolvedValueOnce({from:e.account,to:e.contract}).mockResolvedValueOnce({from:evidence.payout.from,to:e.account,value:1n});await expect(verifyRecordedEvidence()).rejects.toThrow('payout mismatch');});
