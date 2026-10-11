import { indexer } from 'envio';

indexer.onEvent({ contract: 'ChogWearables', event: 'Trade', fields: { transaction: ['hash'], block: ['hash'] } }, async ({ event, context }) => {
  context.MissionTrade.set({
    id: `${event.chainId}_${event.transaction.hash.toLowerCase()}_${event.logIndex}`,
    chainId: event.chainId, contract: event.srcAddress.toLowerCase(),
    transactionHash: event.transaction.hash.toLowerCase(), blockHash: event.block.hash.toLowerCase(),
    blockNumber: String(event.block.number), logIndex: event.logIndex,
    account: event.params.account.toLowerCase(), tokenId: event.params.id.toString(),
    buy: event.params.buy, quantity: event.params.quantity.toString(),
  });
});
