import type { EIP1193Provider } from 'viem';

/** Standard wallet boundary; no SDK types or application authentication here. */
export type WalletBridge = {
  address?: string;
  identity?: string;
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  connect: () => void;
  disconnect: () => Promise<void>;
};
export function createWalletProvider() {
  let bridge: WalletBridge | undefined;
  let generation = 0;
  let lastChain: string | undefined;
  let pending:
    | {
        resolve: (addresses: string[]) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
        promise: Promise<string[]>;
      }
    | undefined;
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const emit = (event: string, ...args: unknown[]) =>
    listeners.get(event)?.forEach((fn) => fn(...args));
  const fail = (
    error: Error = Object.assign(new Error('Wallet connection failed'), {
      code: 4900,
    }),
  ) => {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimeout(current.timer);
    current.reject(error);
  };
  const cancel = () =>
    fail(
      Object.assign(new Error('Wallet connection cancelled'), { code: 4001 }),
    );
  const chainChanged = (chainId: string) => {
    if (!/^0x[0-9a-f]+$/i.test(chainId) || BigInt(chainId) <= 0n) return;
    const normalized = '0x' + BigInt(chainId).toString(16);
    if (lastChain === normalized) return;
    lastChain = normalized;
    emit('chainChanged', normalized);
  };
  return {
    update(next: WalletBridge | undefined) {
      const previous = bridge?.address;
      if (
        previous?.toLowerCase() !== next?.address?.toLowerCase() ||
        bridge?.identity !== next?.identity ||
        !next
      ) {
        generation++;
        lastChain = undefined;
      }
      bridge = next;
      if (next?.address && pending) {
        clearTimeout(pending.timer);
        pending.resolve([next.address]);
        pending = undefined;
      }
      if (previous !== next?.address)
        emit('accountsChanged', next?.address ? [next.address] : []);
      if (!next) cancel();
    },
    cancel,
    fail,
    chainChanged,
    provider: {
      async request(args: { method: string; params?: unknown }) {
        if (args.method === 'eth_accounts')
          return bridge?.address ? [bridge.address] : [];
        if (args.method === 'eth_requestAccounts') {
          if (bridge?.address) return [bridge.address];
          if (!bridge)
            throw Object.assign(new Error('Wallet provider is not ready'), {
              code: 4900,
            });
          if (pending) return pending.promise;
          let resolve!: (value: string[]) => void;
          let reject!: (error: Error) => void;
          const result = new Promise<string[]>((yes, no) => {
            resolve = yes;
            reject = no;
          });
          pending = {
            resolve,
            reject,
            promise: result,
            timer: setTimeout(
              () =>
                fail(
                  Object.assign(new Error('Wallet connection timed out'), {
                    code: 4900,
                  }),
                ),
              120_000,
            ),
          };
          try {
            bridge.connect();
          } catch (error) {
            if (pending) {
              clearTimeout(pending.timer);
              pending.reject(
                error instanceof Error ? error : new Error(String(error)),
              );
              pending = undefined;
            }
          }
          return result;
        }
        if (args.method === 'wallet_revokePermissions') {
          const selected = bridge;
          bridge = undefined;
          generation++;
          lastChain = undefined;
          cancel();
          if (selected?.address) emit('accountsChanged', []);
          await selected?.disconnect();
          return null;
        }
        if (!bridge?.address)
          throw Object.assign(new Error('Wallet disconnected'), { code: 4900 });
        const selected = bridge;
        const selectedGeneration = generation;
        const result = await selected.request(args);
        // Never lose a transaction hash: the transaction may already be broadcast.
        if (
          generation !== selectedGeneration &&
          [
            'personal_sign',
            'eth_sign',
            'eth_signTypedData',
            'eth_signTypedData_v3',
            'eth_signTypedData_v4',
          ].includes(args.method)
        )
          throw Object.assign(
            new Error('Wallet account changed during signing'),
            { code: 4100 },
          );
        if (
          args.method === 'wallet_switchEthereumChain' &&
          bridge === selected
        ) {
          const chainId = await selected.request({ method: 'eth_chainId' });
          if (bridge === selected && typeof chainId === 'string')
            chainChanged(chainId);
        }
        return result;
      },
      on(event: string, listener: (...args: unknown[]) => void) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(listener);
      },
      removeListener(event: string, listener: (...args: unknown[]) => void) {
        listeners.get(event)?.delete(listener);
      },
    } as EIP1193Provider,
  };
}
