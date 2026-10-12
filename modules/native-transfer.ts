import {
  keccak256,
  encodeFunctionData,
  decodeEventLog,
  erc20Abi,
  type Hex,
  type LocalAccount,
  type PublicClient,
} from 'viem';
export interface TransferEvidence {
  signature: string | null;
  chainId: number | null;
  senderAddress: string | null;
  recipientAddress: string;
  amountRaw: bigint;
  evmNonce: bigint | null;
  tokenAddress?: Hex;
}
export async function nativeTransferStatus(
  client: PublicClient,
  op: TransferEvidence,
  chainId: number,
): Promise<'PENDING' | 'FINALIZED' | 'FAILED'> {
  if (!op.signature || op.chainId !== chainId) return 'PENDING';
  if ((await client.getChainId()) !== op.chainId)
    throw new Error('MON_WRONG_CHAIN');
  try {
    const hash = op.signature as Hex;
    const [receipt, transaction, finalized] = await Promise.all([
      client.getTransactionReceipt({ hash }),
      client.getTransaction({ hash }),
      client.getBlock({ blockTag: 'finalized' }),
    ]);
    if (receipt.blockNumber > finalized.number) return 'PENDING';
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    if (
      receipt.transactionHash !== hash ||
      transaction.hash !== hash ||
      transaction.chainId !== op.chainId ||
      block.hash !== receipt.blockHash ||
      transaction.blockHash !== receipt.blockHash ||
      transaction.from.toLowerCase() !== op.senderAddress ||
      transaction.to?.toLowerCase() !==
        (op.tokenAddress ?? op.recipientAddress).toLowerCase() ||
      transaction.value !== (op.tokenAddress ? 0n : op.amountRaw) ||
      BigInt(transaction.nonce) !== op.evmNonce ||
      transaction.input.toLowerCase() !== transferData(op).toLowerCase()
    )
      throw new Error('MON_RECEIPT_MISMATCH');
    if (receipt.status === 'success') {
      if (op.tokenAddress) {
        let transferred = 0n;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== op.tokenAddress.toLowerCase())
            continue;
          try {
            const event = decodeEventLog({
              abi: erc20Abi,
              eventName: 'Transfer',
              data: log.data,
              topics: log.topics,
            });
            if (event.args.from.toLowerCase() !== op.senderAddress) continue;
            if (
              event.args.to.toLowerCase() !== op.recipientAddress.toLowerCase()
            )
              throw new Error('MON_RECEIPT_MISMATCH');
            transferred += event.args.value;
          } catch (error) {
            if ((error as Error).message === 'MON_RECEIPT_MISMATCH')
              throw error;
          }
        }
        if (transferred !== op.amountRaw)
          throw new Error('MON_RECEIPT_MISMATCH');
      }
      return 'FINALIZED';
    }
    if (receipt.status === 'reverted') return 'FAILED';
    // A malformed RPC status must never release funds for another attempt.
    return 'PENDING';
  } catch (error) {
    // Absence and transport errors cannot release a payout reservation.
    if ((error as Error).message === 'MON_RECEIPT_MISMATCH') throw error;
    return 'PENDING';
  }
}
export function transferData(
  op: Pick<TransferEvidence, 'tokenAddress' | 'recipientAddress' | 'amountRaw'>,
): Hex {
  return op.tokenAddress
    ? encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [op.recipientAddress as Hex, op.amountRaw],
      })
    : '0x';
}
export function verifySignedTransfer(raw: Hex, hash: string) {
  if (keccak256(raw) !== hash) throw new Error('MON_TRANSACTION_CHANGED');
  return raw;
}

export async function signNativeTransfer(
  account: LocalAccount,
  transaction: {
    chainId: number;
    nonce: number;
    to: Hex;
    value: bigint;
    gas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    data?: Hex;
  },
) {
  if (![143, 10143].includes(transaction.chainId))
    throw new Error('MON_WRONG_CHAIN');
  if (!Number.isSafeInteger(transaction.nonce) || transaction.nonce < 0)
    throw new Error('MON_NONCE_RANGE');
  if (transaction.gas > 100_000n) throw new Error('MON_RECIPIENT_GAS_LIMIT');
  return account.signTransaction({ type: 'eip1559', ...transaction });
}
