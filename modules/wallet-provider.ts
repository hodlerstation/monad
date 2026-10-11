import type { EIP1193Provider } from 'viem';

/** Standard wallet boundary; no SDK types or application authentication here. */
export type WalletBridge = {
  address?: string;
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  connect: () => void;
  disconnect: () => Promise<void>;
};
export function createWalletProvider() {
  let bridge: WalletBridge | undefined;
  let pending:
    | {
        resolve: (addresses: string[]) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const emit = (event: string, ...args: unknown[]) =>
    listeners.get(event)?.forEach((fn) => fn(...args));
  const cancel = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.reject(
      Object.assign(new Error('Wallet connection cancelled'), { code: 4001 }),
    );
    pending = undefined;
  };
  return {
    update(next: WalletBridge | undefined) {
      const previous = bridge?.address;
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
    chainChanged(chainId: string) {
      emit('chainChanged', chainId);
    },
    provider: {
      async request(args: { method: string; params?: unknown }) {
        if (args.method === 'eth_accounts')
          return bridge?.address ? [bridge.address] : [];
        if (args.method === 'eth_requestAccounts') {
          if (bridge?.address) return [bridge.address];
          if (!bridge) throw new Error('Wallet provider is not ready');
          cancel();
          const result = new Promise<string[]>((resolve, reject) => {
            pending = { resolve, reject, timer: setTimeout(cancel, 120_000) };
          });
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
          await bridge?.disconnect();
          return null;
        }
        if (!bridge?.address)
          throw Object.assign(new Error('Wallet disconnected'), { code: 4900 });
        const selected = bridge;
        const result = await selected.request(args);
        if (
          args.method === 'wallet_switchEthereumChain' &&
          bridge === selected
        ) {
          const chainId = await selected.request({ method: 'eth_chainId' });
          if (bridge === selected) emit('chainChanged', chainId);
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
