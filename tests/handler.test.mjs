import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestIndexer } from 'envio';

// Runs the real registered handler through Envio's simulator, without public RPC or funds.
test('Trade handler preserves uint256, normalizes addresses and separates log indexes', async () => {
  const indexer = createTestIndexer();
  const contract = '0x43dD6Ba111b09e2ee318666B82eA279Dd290BA89';
  const account = '0x' + 'AB'.repeat(20);
  const hash = '0x' + 'CD'.repeat(32);
  const blockHash = '0x' + 'EF'.repeat(32);
  const tokenId = (1n << 256n) - 1n;
  const events = [3, 4].map((logIndex) => ({
    contract: 'ChogWearables',
    event: 'Trade',
    srcAddress: contract,
    logIndex,
    transaction: { hash },
    block: { number: 111647729, hash: blockHash },
    params: {
      account,
      id: tokenId,
      buy: logIndex === 3,
      quantity: 2n,
      amount: 3n,
      total: 4n,
    },
  }));
  await indexer.process({ chains: { 143: { simulate: events } } });
  for (const logIndex of [3, 4]) {
    const id = '143_' + hash.toLowerCase() + '_' + logIndex;
    const row = await indexer.MissionTrade.getOrThrow(id);
    assert.deepEqual(row, {
      id,
      chainId: 143,
      contract: contract.toLowerCase(),
      transactionHash: hash.toLowerCase(),
      blockHash: blockHash.toLowerCase(),
      blockNumber: '111647729',
      logIndex,
      account: account.toLowerCase(),
      tokenId: tokenId.toString(),
      buy: logIndex === 3,
      quantity: '2',
    });
  }
  assert.equal((await indexer.MissionTrade.getAll()).length, 2);
});
