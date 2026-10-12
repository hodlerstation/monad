import { describe, it, expect, afterEach, vi } from 'vitest';
import { EnvioMissionEventSource } from '../envio-mission-event-source';
import { RpcMissionEventSource } from '../mission-event-source';

describe('replaceable mission event source', () => {
  const evidence = {
    chainId: 143,
    contract: '0xabc',
    transactionHash: '0xdef',
    blockHash: '0x123',
    blockNumber: '12',
    logIndex: 1,
    account: '0x456',
    tokenId: '9',
    buy: true,
    quantity: '1',
  };
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });
  function mock(body: unknown) {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => body,
    })) as any;
  }
  it('accepts the same canonical evidence in both implementations', async () => {
    mock({ data: { MissionTrade: [evidence] } });
    expect(await new RpcMissionEventSource().indexed(evidence)).toBe(true);
    expect(
      await new EnvioMissionEventSource(
        'https://indexer.example/graphql',
      ).indexed(evidence),
    ).toBe(true);
  });
  it.each([
    'chainId',
    'contract',
    'transactionHash',
    'blockHash',
    'blockNumber',
    'logIndex',
    'account',
    'tokenId',
    'buy',
    'quantity',
  ])('rejects mismatched %s', async (key) => {
    mock({ data: { MissionTrade: [{ ...evidence, [key]: null }] } });
    expect(
      await new EnvioMissionEventSource(
        'https://indexer.example/graphql',
      ).indexed(evidence),
    ).toBe(false);
  });
  it('keeps lagging indexing pending', async () => {
    mock({ data: { MissionTrade: [] } });
    expect(
      await new EnvioMissionEventSource(
        'https://indexer.example/graphql',
      ).indexed(evidence),
    ).toBe(false);
  });
  it('does not silently fall back on an indexer error', async () => {
    mock({ errors: [{ message: 'unavailable' }] });
    await expect(
      new EnvioMissionEventSource('https://indexer.example/graphql').indexed(
        evidence,
      ),
    ).rejects.toThrow('ENVIO_INVALID_RESPONSE');
  });
});
