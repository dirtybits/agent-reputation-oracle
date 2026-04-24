import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  BASE_CHAIN_CONTEXT,
  SOLANA_DEVNET_CHAIN_CONTEXT,
  SOLANA_MAINNET_CHAIN_CONTEXT,
  getConfiguredSolanaChainDisplayLabel,
  getConfiguredSolanaChainContext,
  getConfiguredSolanaExplorerAddressUrl,
  getConfiguredSolanaExplorerTxUrl,
  getConfiguredSolanaFmTxUrl,
  getConfiguredSolanaRpcTargetLabel,
  normalizeInputChainContext,
  normalizePersistedChainContext,
} from "@/lib/chains";

const ORIGINAL_ENV = { ...process.env };

describe("chains", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SOLANA_CHAIN_CONTEXT;
    delete process.env.NEXT_PUBLIC_SOLANA_CHAIN_CONTEXT;
    delete process.env.SOLANA_RPC_URL;
    delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("normalizes legacy aliases to CAIP-2 chain contexts", () => {
    expect(normalizeInputChainContext("solana:mainnet-beta")).toBe(
      SOLANA_MAINNET_CHAIN_CONTEXT
    );
    expect(normalizeInputChainContext("solana:devnet")).toBe(
      SOLANA_DEVNET_CHAIN_CONTEXT
    );
    expect(normalizeInputChainContext("base")).toBe(BASE_CHAIN_CONTEXT);
  });

  it("uses the configured RPC cluster for bare solana aliases", () => {
    process.env.SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
    expect(normalizeInputChainContext("solana")).toBe(
      SOLANA_MAINNET_CHAIN_CONTEXT
    );
  });

  it("defaults to devnet when no explicit cluster is configured", () => {
    expect(getConfiguredSolanaChainContext()).toBe(SOLANA_DEVNET_CHAIN_CONTEXT);
  });

  it("derives configured Solana labels and explorer URLs for devnet", () => {
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";

    expect(getConfiguredSolanaChainDisplayLabel()).toBe("Solana Devnet");
    expect(getConfiguredSolanaRpcTargetLabel()).toBe("devnet");
    expect(getConfiguredSolanaFmTxUrl("abc")).toBe(
      "https://solana.fm/tx/abc?cluster=devnet-solana"
    );
    expect(getConfiguredSolanaExplorerTxUrl("abc")).toBe(
      "https://explorer.solana.com/tx/abc?cluster=devnet"
    );
    expect(getConfiguredSolanaExplorerAddressUrl("abc")).toBe(
      "https://explorer.solana.com/address/abc?cluster=devnet"
    );
  });

  it("derives configured Solana labels and explorer URLs for mainnet", () => {
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL =
      "https://api.mainnet-beta.solana.com";

    expect(getConfiguredSolanaChainDisplayLabel()).toBe("Solana");
    expect(getConfiguredSolanaRpcTargetLabel()).toBe("mainnet");
    expect(getConfiguredSolanaFmTxUrl("abc")).toBe(
      "https://solana.fm/tx/abc?cluster=mainnet-solana"
    );
    expect(getConfiguredSolanaExplorerTxUrl("abc")).toBe(
      "https://explorer.solana.com/tx/abc"
    );
    expect(getConfiguredSolanaExplorerAddressUrl("abc")).toBe(
      "https://explorer.solana.com/address/abc"
    );
  });

  it("preserves unknown stored values instead of guessing silently", () => {
    expect(normalizePersistedChainContext("custom:unknown-network")).toBe(
      "custom:unknown-network"
    );
  });
});
