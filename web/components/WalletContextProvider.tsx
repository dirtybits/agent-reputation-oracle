'use client';

import { FC, ReactNode, useMemo } from 'react';
import { SolanaProvider } from '@solana/react-hooks';
import { autoDiscover, createClient } from '@solana/client';
import { PhantomProvider, type PhantomSDKConfig } from '@phantom/react-sdk';

const ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const PHANTOM_APP_ID = process.env.NEXT_PUBLIC_PHANTOM_APP_ID ?? '';

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const client = useMemo(
    () =>
      createClient({
        endpoint: ENDPOINT,
        walletConnectors: autoDiscover(),
      }),
    [],
  );

  const phantomConfig = useMemo<PhantomSDKConfig>(() => ({
    appId: PHANTOM_APP_ID,
    providers: ['google', 'apple'],
    addressTypes: ['Solana' as any],
  }), []);

  const solanaProvider = (
    <SolanaProvider client={client}>{children}</SolanaProvider>
  );

  // Only wrap with PhantomProvider when an appId is configured.
  // Without an appId the SDK throws immediately on mount.
  if (!PHANTOM_APP_ID) {
    return solanaProvider;
  }

  return (
    <PhantomProvider config={phantomConfig}>
      {solanaProvider}
    </PhantomProvider>
  );
};
