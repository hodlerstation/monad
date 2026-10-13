import { createPublicClient, decodeEventLog, http, parseAbi } from 'viem';
import { EnvioMissionEventSource } from '../envio-mission-event-source';
import evidence from '../../submission/evidence.json';

// Read-only historical replay, not eligibility for a new participant or a Claim API.
export async function verifyRecordedEvidence() {
  const rpc = createPublicClient({ transport: http('https://rpc.monad.xyz', { timeout: 15000, retryCount: 0 }) });
  if (await rpc.getChainId() !== 143) throw new Error('Wrong RPC chain');
  const hash = evidence.trade.hash as `0x${string}`;
  const receipt = await rpc.getTransactionReceipt({ hash });
  const [block, finalized, transaction] = await Promise.all([
    rpc.getBlock({ blockNumber: receipt.blockNumber }),
    rpc.getBlock({ blockTag: 'finalized' }),
    rpc.getTransaction({ hash }),
  ]);
  const expected = evidence.indexer.event;
  if (receipt.status !== 'success' || block.hash !== receipt.blockHash ||
      receipt.blockHash !== expected.blockHash || receipt.blockNumber.toString() !== expected.blockNumber ||
      finalized.number < receipt.blockNumber || transaction.from.toLowerCase() !== expected.account ||
      transaction.to?.toLowerCase() !== expected.contract) throw new Error('Canonical trade mismatch');
  const log = receipt.logs.find(log => log.logIndex === expected.logIndex);
  if (!log || log.removed || log.address.toLowerCase() !== expected.contract || log.blockHash !== block.hash || log.transactionHash !== hash)
    throw new Error('Trade log mismatch');
  const event = decodeEventLog({ abi: parseAbi(['event Trade(address indexed account,uint256 indexed id,bool buy,uint256 quantity,uint256 amount,uint256 total)']), data: log.data, topics: log.topics });
  const args = event.args;
  if (args.account.toLowerCase() !== expected.account || args.id.toString() !== expected.tokenId ||
      args.buy !== expected.buy || args.quantity.toString() !== expected.quantity) throw new Error('Trade fields mismatch');
  const source = new EnvioMissionEventSource(evidence.indexer.endpoint, undefined, [{ chainId: 143, contract: expected.contract }]);
  if (!await source.indexed(expected)) throw new Error('Event not indexed: approval remains pending');
  const payoutHash = evidence.payout.hash as `0x${string}`;
  const [payout, payoutReceipt] = await Promise.all([rpc.getTransaction({ hash: payoutHash }), rpc.getTransactionReceipt({ hash: payoutHash })]);
  const payoutBlock = await rpc.getBlock({ blockNumber: payoutReceipt.blockNumber });
  if (payoutReceipt.status !== 'success' || payoutBlock.hash !== payoutReceipt.blockHash ||
      finalized.number < payoutReceipt.blockNumber || payout.from.toLowerCase() !== evidence.payout.from ||
      payout.to?.toLowerCase() !== expected.account || payout.value.toString() !== evidence.payout.value)
    throw new Error('Recorded payout mismatch');
  return { chainId: 143, canonicalTrade: hash, indexed: true, recordedParticipant: expected.account,
    canonicalPayout: payoutHash, payoutWei: payout.value.toString(), newClaimAuthorized: false };
}
