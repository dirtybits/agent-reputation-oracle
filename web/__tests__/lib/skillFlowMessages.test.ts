import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPaidSkillDownloadRequiredMessage,
  buildSignedDownloadErrorMessage,
  getConfiguredSkillFlowNetworkDescription,
} from "@/lib/skillFlowMessages";

const ORIGINAL_ENV = { ...process.env };

describe("skillFlowMessages", () => {
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

  it("describes the configured devnet network for skill flows", () => {
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";

    expect(getConfiguredSkillFlowNetworkDescription()).toBe(
      "Solana Devnet (devnet RPC)"
    );
  });

  it("builds a paid download message with the configured network", () => {
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL =
      "https://api.mainnet-beta.solana.com";

    expect(buildPaidSkillDownloadRequiredMessage()).toContain(
      "configured Solana (mainnet RPC)"
    );
  });

  it("maps payment-required download errors to network-aware guidance", () => {
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";

    expect(
      buildSignedDownloadErrorMessage(
        "Payment required",
        "Call purchaseSkill on-chain, then retry."
      )
    ).toContain("switch Phantom and the app to the same cluster");
  });

  it("preserves non-payment download errors", () => {
    expect(
      buildSignedDownloadErrorMessage(
        "Malformed X-AgentVouch-Auth header",
        null
      )
    ).toBe("Malformed X-AgentVouch-Auth header");
  });
});
