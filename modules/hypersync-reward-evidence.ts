import { transferData, type TransferEvidence } from './native-transfer';

export type RewardIndexStatus = 'verified' | 'pending' | 'mismatch' | 'unavailable' | 'not_configured' | 'unsupported';
export type IndexedReward = TransferEvidence & { blockNumber: number; blockHash: string };
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CHOG = '0x350035555e10d9afaf1566aaebfced5ba6c27777';
const eq = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
const topic = (address: string) => '0x' + address.slice(2).toLowerCase().padStart(64, '0');
const integer = (value: unknown): bigint | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^(0x[0-9a-f]+|[0-9]+)$/i.test(value)) return BigInt(value);
  return null;
};
type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => {
  if (!Array.isArray(value) || value.some(v => !v || typeof v !== 'object' || Array.isArray(v))) throw Error('Invalid response');
  return value as Row[];
};

/** Read-only proof for direct treasury rewards. Caller must first establish RPC finality/canonicality. */
export async function verifyHyperSyncReward(
  reward: IndexedReward,
  token: string | undefined,
  request: typeof fetch = fetch,
): Promise<RewardIndexStatus> {
  if (reward.chainId !== 143 || (reward.tokenAddress && !eq(reward.tokenAddress, CHOG))) return 'unsupported';
  if (!token?.trim()) return 'not_configured';
  if (!Number.isSafeInteger(reward.blockNumber) || reward.blockNumber < 0 || reward.blockNumber >= Number.MAX_SAFE_INTEGER ||
      !/^0x[0-9a-f]{64}$/i.test(reward.signature ?? '') || !/^0x[0-9a-f]{64}$/i.test(reward.blockHash) ||
      !/^0x[0-9a-f]{40}$/i.test(reward.senderAddress ?? '') || !/^0x[0-9a-f]{40}$/i.test(reward.recipientAddress) || reward.amountRaw <= 0n) return 'mismatch';
  try {
    const response = await request('https://monad.hypersync.xyz/query', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
      body: JSON.stringify({
        from_block: reward.blockNumber, to_block: reward.blockNumber + 1,
        include_all_blocks: true,
        transactions: [{ from: [reward.senderAddress], to: [reward.tokenAddress ?? reward.recipientAddress], status: 1 }],
        logs: reward.tokenAddress ? [{ address: [reward.tokenAddress], topics: [[TRANSFER], [topic(reward.senderAddress!)], [topic(reward.recipientAddress)]] }] : [],
        field_selection: {
          block: ['number', 'hash'],
          transaction: ['block_number', 'block_hash', 'hash', 'from', 'to', 'value', 'input', 'status', 'nonce'],
          log: ['block_number', 'block_hash', 'transaction_hash', 'log_index', 'address', 'data', 'topic0', 'topic1', 'topic2', 'removed'],
        },
      }),
    });
    if (!response.ok) return 'unavailable';
    // Bound transport memory even if the provider returns an unexpected response.
    const reader = response.body?.getReader();
    if (!reader) return 'unavailable';
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); return 'unavailable'; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!Number.isSafeInteger(body.next_block)) return 'unavailable';
    if (body.next_block <= reward.blockNumber) return 'pending';
    const blocks = rows(body.data?.blocks);
    const transactions = rows(body.data?.transactions);
    const logs = rows(body.data?.logs);
    const block = blocks.filter(b => integer(b.number) === BigInt(reward.blockNumber));
    if (block.length !== 1 || !eq(block[0].hash, reward.blockHash)) return 'mismatch';
    const matches = transactions.filter(tx => eq(tx.hash, reward.signature!));
    if (!matches.length) return 'pending';
    if (matches.length !== 1) return 'mismatch';
    const tx = matches[0];
    if (!eq(tx.block_hash, reward.blockHash) || integer(tx.block_number) !== BigInt(reward.blockNumber) ||
        !eq(tx.from, reward.senderAddress!) || !eq(tx.to, reward.tokenAddress ?? reward.recipientAddress) ||
        integer(tx.status) !== 1n || integer(tx.value) !== (reward.tokenAddress ? 0n : reward.amountRaw) ||
        integer(tx.nonce) !== reward.evmNonce || !eq(tx.input, transferData(reward))) return 'mismatch';
    if (reward.tokenAddress) {
      const seen = new Set<string>(); let amount = 0n;
      for (const log of logs.filter(l => eq(l.transaction_hash, reward.signature!))) {
        if (!eq(log.address, reward.tokenAddress) || !eq(log.topic0, TRANSFER)) continue;
        const index = integer(log.log_index);
        if (index === null || seen.has(index.toString()) || log.removed === true ||
            !eq(log.block_hash, reward.blockHash) || integer(log.block_number) !== BigInt(reward.blockNumber) ||
            !eq(log.topic1, topic(reward.senderAddress!)) || !eq(log.topic2, topic(reward.recipientAddress)) ||
            typeof log.data !== 'string' || !/^0x[0-9a-f]{64}$/i.test(log.data)) return 'mismatch';
        seen.add(index.toString()); amount += BigInt(log.data);
      }
      if (!seen.size) return 'pending';
      if (amount !== reward.amountRaw) return 'mismatch';
    }
    return 'verified';
  } catch { return 'unavailable'; }
}
