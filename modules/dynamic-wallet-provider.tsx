'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DynamicContextProvider,
  useDynamicContext,
  useDynamicEvents,
} from '@dynamic-labs/sdk-react-core';
import {
  EthereumWalletConnectors,
  isEthereumWallet,
} from '@dynamic-labs/ethereum';
import type { createWalletProvider } from './wallet-provider';

function Bridge({
  walletProviderBridge,
  userId,
  sessionReady = true,
}: {
  walletProviderBridge: ReturnType<typeof createWalletProvider>;
  userId?: string;
  sessionReady?: boolean;
}) {
  const {
    primaryWallet,
    setShowAuthFlow,
    handleLogOut,
    network,
    sdkHasLoaded,
  } = useDynamicContext();
  const previousUser = useRef(userId);
  const userInitialized = useRef(sessionReady);
  const reset = useRef({ blocked: false, settled: false, sequence: 0 });
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  const identity =
    (primaryWallet?.id ?? '') + ':' + (primaryWallet?.address ?? '');
  const latest = useRef({
    primaryWallet,
    userId,
    sessionReady,
    identity,
    version: 0,
  });
  const previous = latest.current;
  latest.current = {
    primaryWallet,
    userId,
    sessionReady,
    identity,
    version:
      previous.version +
      (previous.identity !== identity ||
      previous.userId !== userId ||
      previous.sessionReady !== sessionReady
        ? 1
        : 0),
  };
  useDynamicEvents('authFlowCancelled', walletProviderBridge.cancel);
  useDynamicEvents('authFailure', (_method, reason) => {
    if (typeof reason === 'string') walletProviderBridge.cancel();
    else walletProviderBridge.fail();
  });
  useDynamicEvents('walletConnectionFailed', () => walletProviderBridge.fail());
  useDynamicEvents('logout', () => {
    reset.current.blocked = true;
    reset.current.settled = true;
    walletProviderBridge.update(undefined);
    setRevision((value) => value + 1);
  });
  useEffect(() => {
    if (!sessionReady || !sdkHasLoaded) {
      walletProviderBridge.update(undefined);
      return;
    }
    if (!userInitialized.current) {
      previousUser.current = userId;
      userInitialized.current = true;
    }
    if (previousUser.current !== userId) {
      previousUser.current = userId;
      const sequence = ++reset.current.sequence;
      reset.current.blocked = true;
      reset.current.settled = false;
      walletProviderBridge.update(undefined);
      void handleLogOut()
        .then(() => {
          if (reset.current.sequence !== sequence) return;
          reset.current.settled = true;
          setRevision((value) => value + 1);
        })
        .catch(() => {
          walletProviderBridge.fail();
        });
      return;
    }
    if (reset.current.blocked) {
      if (!reset.current.settled || primaryWallet !== null) {
        walletProviderBridge.update(undefined);
        return;
      }
      reset.current.blocked = false;
    }
    const wallet =
      primaryWallet && isEthereumWallet(primaryWallet) ? primaryWallet : null;
    walletProviderBridge.update({
      address: wallet?.address,
      identity: wallet ? wallet.id : undefined,
      connect: () => setShowAuthFlow(true),
      disconnect: async () => {
        reset.current.blocked = true;
        reset.current.settled = false;
        walletProviderBridge.update(undefined);
        await handleLogOut();
        reset.current.settled = true;
        setRevision((value) => value + 1);
      },
      request: async (args) => {
        if (!wallet)
          throw Object.assign(new Error('EVM wallet unavailable'), {
            code: 4900,
          });
        const version = latest.current.version;
        const client = await wallet.getWalletClient();
        const current = latest.current;
        // A client lookup may finish after app logout or an SDK account switch.
        if (
          !mounted.current ||
          current.version !== version ||
          reset.current.blocked ||
          !current.sessionReady ||
          current.userId !== userId ||
          current.primaryWallet?.id !== wallet.id ||
          current.primaryWallet?.address !== wallet.address
        )
          throw Object.assign(new Error('Wallet account changed'), {
            code: 4100,
          });
        return client.request(args as Parameters<typeof client.request>[0]);
      },
    });
    if (
      wallet &&
      network != null &&
      Number.isSafeInteger(Number(network)) &&
      Number(network) > 0
    )
      walletProviderBridge.chainChanged('0x' + Number(network).toString(16));
  }, [
    primaryWallet,
    primaryWallet?.address,
    network,
    sdkHasLoaded,
    sessionReady,
    userId,
    revision,
    setShowAuthFlow,
    handleLogOut,
    walletProviderBridge,
  ]);
  useEffect(() => {
    mounted.current = true;
    const resetState = reset.current;
    return () => {
      mounted.current = false;
      resetState.sequence++;
      walletProviderBridge.update(undefined);
    };
  }, [walletProviderBridge]);
  return null;
}

export default function DynamicWalletProvider({
  children,
  environmentId,
  evmNetworks,
  walletProviderBridge,
  userId,
  sessionReady = true,
}: {
  environmentId: string;
  evmNetworks: NonNullable<
    NonNullable<
      React.ComponentProps<
        typeof DynamicContextProvider
      >['settings']['overrides']
    >['evmNetworks']
  >;
  walletProviderBridge: ReturnType<typeof createWalletProvider>;
  userId?: string;
  sessionReady?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        initialAuthenticationMode: 'connect-only',
        walletConnectors: [EthereumWalletConnectors],
        overrides: { evmNetworks },
      }}
    >
      <Bridge
        walletProviderBridge={walletProviderBridge}
        userId={userId}
        sessionReady={sessionReady}
      />
      {children}
    </DynamicContextProvider>
  );
}
