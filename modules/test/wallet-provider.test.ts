import { describe, it, expect, vi } from 'vitest';
import { createWalletProvider, type WalletBridge } from '../wallet-provider';

describe('standard wallet adapter boundary', () => {
  const wallet: WalletBridge = {
    connect: vi.fn(),
    disconnect: vi.fn(async () => {}),
    request: vi.fn(async () => '0x8f'),
  };
  it('waits for connection and forwards signatures without SDK types', async () => {
    const bridge = createWalletProvider();
    bridge.update(wallet);
    const result = bridge.provider.request({ method: 'eth_requestAccounts' });
    bridge.update({ ...wallet, address: '0x123' });
    expect(await result).toEqual(['0x123']);
    await bridge.provider.request({
      method: 'personal_sign',
      params: ['0x123', '0x123'],
    });
    expect(wallet.request).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: ['0x123', '0x123'],
    });
  });
  it('rejects a cancelled modal and permits another attempt', async () => {
    const bridge = createWalletProvider();
    bridge.update(wallet);
    const result = bridge.provider.request({ method: 'eth_requestAccounts' });
    bridge.cancel();
    await expect(result).rejects.toMatchObject({ code: 4001 });
    expect(await bridge.provider.request({ method: 'eth_accounts' })).toEqual(
      [],
    );
  });
  it('clears accounts and rejects signatures after unmount', async () => {
    const bridge = createWalletProvider();
    bridge.update({ ...wallet, address: '0x123' });
    bridge.update(undefined);
    expect(await bridge.provider.request({ method: 'eth_accounts' })).toEqual(
      [],
    );
    await expect(
      bridge.provider.request({
        method: 'personal_sign',
        params: ['0x123', '0x123'],
      }),
    ).rejects.toMatchObject({ code: 4900 });
  });
  it('cleans up when opening the wallet modal throws and permits retry', async () => {
    const bridge = createWalletProvider();
    bridge.update({
      ...wallet,
      connect: () => {
        throw new Error('modal failed');
      },
    });
    await expect(
      bridge.provider.request({ method: 'eth_requestAccounts' }),
    ).rejects.toThrow('modal failed');
    bridge.update(wallet);
    const retry = bridge.provider.request({ method: 'eth_requestAccounts' });
    bridge.update({ ...wallet, address: '0x123' });
    expect(await retry).toEqual(['0x123']);
  });
  it('does not read a replacement wallet after an in-flight chain switch', async () => {
    const bridge = createWalletProvider();
    let resolve!: (value: unknown) => void;
    const request = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    bridge.update({ ...wallet, address: '0x123', request });
    const changed = vi.fn();
    bridge.provider.on('chainChanged', changed);
    const result = bridge.provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x8f' }],
    });
    const replacement = vi.fn(async () => '0x38');
    bridge.update({ ...wallet, address: '0x456', request: replacement });
    resolve(null);
    await result;
    expect(replacement).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });
  it('does not emit a stale chain event after disconnecting during chain lookup', async () => {
    const bridge = createWalletProvider();
    let resolve!: (value: unknown) => void;
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === 'eth_chainId')
        return new Promise((done) => {
          resolve = done;
        });
      return null;
    });
    bridge.update({ ...wallet, address: '0x123', request });
    const changed = vi.fn();
    bridge.provider.on('chainChanged', changed);
    const result = bridge.provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x8f' }],
    });
    await vi.waitFor(() =>
      expect(request).toHaveBeenCalledWith({ method: 'eth_chainId' }),
    );
    bridge.update(undefined);
    resolve('0x8f');
    await result;
    expect(changed).not.toHaveBeenCalled();
  });

  it('shares concurrent connection requests and opens one dialog', async () => {
    const bridge = createWalletProvider();
    const connect = vi.fn();
    bridge.update({ ...wallet, connect });
    const a = bridge.provider.request({ method: 'eth_requestAccounts' }),
      b = bridge.provider.request({ method: 'eth_requestAccounts' });
    bridge.update({ ...wallet, address: '0x123' });
    expect(await Promise.all([a, b])).toEqual([['0x123'], ['0x123']]);
    expect(connect).toHaveBeenCalledTimes(1);
  });
  it('times out every waiter and permits retry', async () => {
    vi.useFakeTimers();
    try {
      const bridge = createWalletProvider();
      bridge.update(wallet);
      const request = bridge.provider.request({
        method: 'eth_requestAccounts',
      });
      const check = expect(request).rejects.toMatchObject({ code: 4900 });
      await vi.advanceTimersByTimeAsync(120000);
      await check;
      const retry = bridge.provider.request({ method: 'eth_requestAccounts' });
      bridge.update({ ...wallet, address: '0x123' });
      expect(await retry).toEqual(['0x123']);
    } finally {
      vi.useRealTimers();
    }
  });
  it.each(['personal_sign', 'eth_signTypedData_v4'])(
    'rejects stale %s after account replacement',
    async (method) => {
      const bridge = createWalletProvider();
      let resolve!: (value: unknown) => void;
      bridge.update({
        ...wallet,
        address: '0x123',
        request: () =>
          new Promise((done) => {
            resolve = done;
          }),
      });
      const request = bridge.provider.request({ method } as never);
      bridge.update({ ...wallet, address: '0x456' });
      resolve('signature');
      await expect(request).rejects.toMatchObject({ code: 4100 });
    },
  );
  it('preserves an already-broadcast transaction hash after an account change', async () => {
    const bridge = createWalletProvider();
    let resolve!: (value: unknown) => void;
    bridge.update({
      ...wallet,
      address: '0x123',
      request: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const request = bridge.provider.request({
      method: 'eth_sendTransaction',
      params: [],
    } as never);
    bridge.update(undefined);
    resolve('0xhash');
    expect(await request).toBe('0xhash');
  });
  it('clears accounts immediately while disconnect is still pending', async () => {
    const bridge = createWalletProvider();
    let resolve!: () => void;
    bridge.update({
      ...wallet,
      address: '0x123',
      disconnect: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const result = bridge.provider.request({
      method: 'wallet_revokePermissions',
      params: [],
    } as never);
    expect(await bridge.provider.request({ method: 'eth_accounts' })).toEqual(
      [],
    );
    resolve();
    await result;
  });
  it('normalizes valid chain IDs and suppresses duplicates and invalid values', () => {
    const bridge = createWalletProvider();
    const changed = vi.fn();
    bridge.provider.on('chainChanged', changed);
    for (const chain of ['0x08F', '0x8f', '0x0', 'wat', '-1'])
      bridge.chainChanged(chain);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith('0x8f');
    bridge.provider.removeListener('chainChanged', changed);
    bridge.chainChanged('0x38');
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
