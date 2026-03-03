'use client';

import { FC, ReactNode, useMemo } from 'react';
import { SolanaProvider } from '@solana/react-hooks';
import { autoDiscover, createClient } from '@solana/client';

const ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const client = useMemo(
    () =>
      createClient({
        endpoint: ENDPOINT,
        walletConnectors: autoDiscover(),
      }),
    [],
  );

  return <SolanaProvider client={client}>{children}</SolanaProvider>;
};
