"use client";

import {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SolanaProvider } from "@solana/react-hooks";
import { autoDiscover, createClient } from "@solana/client";
import { PhantomProvider, type PhantomSDKConfig } from "@phantom/react-sdk";

const PhantomConfiguredContext = createContext(false);
export const usePhantomConfigured = () => useContext(PhantomConfiguredContext);

const ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PHANTOM_APP_ID = process.env.NEXT_PUBLIC_PHANTOM_APP_ID ?? "";

export const WalletContextProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [mounted, setMounted] = useState(false);
  const [phantomReady, setPhantomReady] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && PHANTOM_APP_ID) setPhantomReady(true);
  }, [mounted]);

  const client = useMemo(
    () =>
      createClient({
        endpoint: ENDPOINT,
        walletConnectors: autoDiscover(),
      }),
    []
  );

  const phantomConfig = useMemo<PhantomSDKConfig>(
    () => ({
      appId: PHANTOM_APP_ID,
      providers: ["google", "apple"],
      addressTypes: ["Solana" as any],
    }),
    []
  );

  const wantsPhantom = mounted && !!PHANTOM_APP_ID;

  const solanaProvider = (
    <SolanaProvider client={client}>{children}</SolanaProvider>
  );

  return (
    <PhantomConfiguredContext.Provider value={phantomReady}>
      {wantsPhantom ? (
        <PhantomProvider config={phantomConfig}>
          {solanaProvider}
        </PhantomProvider>
      ) : (
        solanaProvider
      )}
    </PhantomConfiguredContext.Provider>
  );
};
