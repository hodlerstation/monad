import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { createPublicClient, http } from 'viem';
// Read-only, known historical MON payout. An optional JSON file may supply another reward.
const file = process.argv[2] ?? new URL('../submission/mon-reward.json', import.meta.url);
const input = JSON.parse(await fs.readFile(file, 'utf8'));
const reward = { ...input, amountRaw: BigInt(input.amountRaw), evmNonce: BigInt(input.evmNonce) };
if (!process.env.ENVIO_HYPERSYNC_TOKEN) {
  console.error('ENVIO_HYPERSYNC_TOKEN is required. Keep it outside Git.');
  process.exit(1);
}
const server = await createServer({ root: new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), server: { middlewareMode: true } });
try {
  const { nativeTransferStatus } = await server.ssrLoadModule('/native-transfer.ts');
  const { verifyHyperSyncReward } = await server.ssrLoadModule('/hypersync-reward-evidence.ts');
  const client = createPublicClient({ transport: http('https://rpc.monad.xyz', { timeout: 8000, retryCount: 0 }) });
  const canonical = await nativeTransferStatus(client, reward, 143);
  if (canonical !== 'FINALIZED') throw Error('CANONICAL_PROOF_UNAVAILABLE');
  const receipt = await client.getTransactionReceipt({ hash: reward.signature });
  const status = await verifyHyperSyncReward({ ...reward, blockNumber: Number(receipt.blockNumber), blockHash: receipt.blockHash }, process.env.ENVIO_HYPERSYNC_TOKEN);
  console.log(JSON.stringify({ canonical, status, chainId:143, transactionHash:reward.signature, blockNumber:receipt.blockNumber.toString(), recipient:reward.recipientAddress, amountRaw:reward.amountRaw.toString() }, null, 2));
  if (status !== 'verified') process.exitCode = 1;
} catch {
  console.error('Reward evidence check failed; no transaction was sent.');
  process.exitCode = 1;
} finally { await server.close(); }
