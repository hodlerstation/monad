'use client';

import { useEffect, useRef } from 'react';
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
}: {
  walletProviderBridge: ReturnType<typeof createWalletProvider>;
  userId?: string;
}) {
  const { primaryWallet, setShowAuthFlow, handleLogOut, network } =
    useDynamicContext();
  const previousUser = useRef(userId);
  // Successful connections can close the dialog before primaryWallet is updated.
  // Only the SDK's explicit cancellation event should reject the pending request.
  useDynamicEvents('authFlowCancelled', walletProviderBridge.cancel);
  useEffect(() => {
    if (previousUser.current && previousUser.current !== userId) {
      walletProviderBridge.update(undefined);
      void handleLogOut();
    }
    previousUser.current = userId;
  }, [userId, handleLogOut, walletProviderBridge]);
  useEffect(() => {
    const wallet =
      primaryWallet && isEthereumWallet(primaryWallet) ? primaryWallet : null;
    walletProviderBridge.update({
      address: wallet?.address,
      connect: () => setShowAuthFlow(true),
      disconnect: handleLogOut,
      request: async (args) => {
        if (!wallet) throw new Error('EVM wallet unavailable');
        const client = await wallet.getWalletClient();
        return client.request(args as Parameters<typeof client.request>[0]);
      },
    });
  }, [primaryWallet, setShowAuthFlow, handleLogOut, walletProviderBridge]);
  useEffect(
    () => () => walletProviderBridge.update(undefined),
    [walletProviderBridge],
  );
  useEffect(() => {
    if (network != null && Number.isSafeInteger(Number(network)))
      walletProviderBridge.chainChanged(`0x${Number(network).toString(16)}`);
  }, [network, walletProviderBridge]);
  return null;
}

export default function DynamicWalletProvider({
  children,
  environmentId,
  evmNetworks,
  walletProviderBridge,
  userId,
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
      <Bridge walletProviderBridge={walletProviderBridge} userId={userId} />
      {children}
    </DynamicContextProvider>
  );
}
