import { describe, it, expect, afterEach, vi } from 'vitest';
import { EnvioMissionEventSource } from '../envio-mission-event-source';
import { RpcMissionEventSource } from '../mission-event-source';

describe('replaceable mission event source', () => {
  const evidence = {
    chainId: 143,
    contract: '0x' + 'ab'.repeat(20),
    transactionHash: '0x' + 'de'.repeat(32),
    blockHash: '0x' + 'cd'.repeat(32),
    blockNumber: '12',
    logIndex: 1,
    account: '0x' + '45'.repeat(20),
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

  it.each(Object.keys(evidence))('rejects missing input %s before fetch', async key => {
    mock({ data: { MissionTrade: [evidence] } });
    const partial: any = { ...evidence }; delete partial[key];
    await expect(new EnvioMissionEventSource('https://indexer.example/graphql').indexed(partial)).rejects.toThrow('ENVIO_INVALID_EVIDENCE');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it.each([null, {}, {data:null}, {data:{MissionTrade:{}}}, {errors:'bad',data:{MissionTrade:[]}}, {data:{MissionTrade:[evidence,evidence]}}])('rejects malformed response %#', async body => {
    mock(body);
    await expect(new EnvioMissionEventSource('https://indexer.example/graphql').indexed(evidence)).rejects.toThrow('ENVIO_INVALID_RESPONSE');
  });
  it.each([[401,'ENVIO_UNAUTHORIZED'],[403,'ENVIO_UNAUTHORIZED'],[429,'ENVIO_RATE_LIMITED'],[500,'ENVIO_UNAVAILABLE'],[503,'ENVIO_UNAVAILABLE']])('classifies HTTP %s', async (status, code) => {
    global.fetch = vi.fn(async () => ({ok:false,status})) as any;
    await expect(new EnvioMissionEventSource('https://indexer.example/graphql').indexed(evidence)).rejects.toThrow(String(code));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([['quantity','0'],['quantity','1e3'],['tokenId','-1'],['tokenId',(1n<<256n).toString()],['blockNumber','01'],['chainId',NaN],['logIndex',-1],['logIndex',1.5],['buy','true'],['account','0xabc']])('rejects invalid %s=%s', async (key,value) => {
    mock({data:{MissionTrade:[evidence]}});
    await expect(new EnvioMissionEventSource('https://indexer.example/graphql').indexed({...evidence,[key]:value} as any)).rejects.toThrow('ENVIO_INVALID_EVIDENCE');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('rejects a scope mismatch before fetching', async () => {
    mock({data:{MissionTrade:[evidence]}});
    const adapter = new EnvioMissionEventSource('https://indexer.example/graphql', undefined, [{chainId:10143,contract:evidence.contract}]);
    await expect(adapter.indexed(evidence)).rejects.toThrow('ENVIO_UNSUPPORTED_SCOPE');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('normalizes hex case and ignores non-evidence metadata', async () => {
    mock({data:{MissionTrade:[{...evidence,transactionHash:evidence.transactionHash.toUpperCase().replace('0X','0x')}]}});
    expect(await new EnvioMissionEventSource('https://indexer.example/graphql').indexed({...evidence,extra:'ignored'} as any)).toBe(true);
  });
  it('normalizes network and malformed JSON failures', async () => {
    const adapter = new EnvioMissionEventSource('https://indexer.example/graphql');
    global.fetch = vi.fn().mockRejectedValue(new Error('secret URL'));
    await expect(adapter.indexed(evidence)).rejects.toThrow('ENVIO_UNAVAILABLE');
    global.fetch = vi.fn(async () => ({ok:true,json:async()=>{throw new SyntaxError('bad')}})) as any;
    await expect(adapter.indexed(evidence)).rejects.toThrow('ENVIO_INVALID_RESPONSE');
  });
  it('passes an abort deadline and disallows redirects', async () => {
    mock({data:{MissionTrade:[]}});
    await new EnvioMissionEventSource('https://indexer.example/graphql','token').indexed(evidence);
    const options = (global.fetch as any).mock.calls[0][1];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.redirect).toBe('error');
    expect(options.headers.Authorization).toBe('Bearer token');
  });

});
