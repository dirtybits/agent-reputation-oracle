import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_CHAIN_CONTEXT, SOLANA_MAINNET_CHAIN_CONTEXT } from "@/lib/chains";
import {
  buildLocalCanonicalAgentId,
  buildRegistryCanonicalAgentId,
} from "@/lib/agentIdentity";

const ORIGINAL_ENV = { ...process.env };

describe("agentIdentity", () => {
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

  it("builds local canonical ids with CAIP-2 prefixes", () => {
    expect(
      buildLocalCanonicalAgentId(
        "Wallet1111111111111111111111111111111111",
        BASE_CHAIN_CONTEXT
      )
    ).toBe(
      "eip155:8453:agentvouch-local#Wallet1111111111111111111111111111111111"
    );
  });

  it("builds registry canonical ids without losing the upstream record id", () => {
    expect(
      buildRegistryCanonicalAgentId(
        "RegistryProgram1111111111111111111111111111111",
        "CoreAsset11111111111111111111111111111111111",
        SOLANA_MAINNET_CHAIN_CONTEXT
      )
    ).toBe(
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:RegistryProgram1111111111111111111111111111111#CoreAsset11111111111111111111111111111111111"
    );
  });

  it("normalizes legacy chain aliases before composing ids", () => {
    expect(
      buildRegistryCanonicalAgentId(
        "RegistryProgram1111111111111111111111111111111",
        "42",
        "base"
      )
    ).toBe("eip155:8453:RegistryProgram1111111111111111111111111111111#42");
  });
});
