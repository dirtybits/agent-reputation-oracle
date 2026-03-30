import { address, type TransactionSigner } from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
  getRevokeVouchInstructionAsync,
  getVouchInstructionAsync,
} from "@/generated/reputation-oracle/src/generated";
import {
  buildTransactionSendRequest,
  getStakeClusterGuardError,
  normalizeInstructionForSend,
} from "@/hooks/useReputationOracle";

const VOUCHER_ADDRESS = address("asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw");
const VOUCHEE_PROFILE = address("Es9vMFrzaCERmJfrN7kYMva9n32CuWHa3gwxMZ2y1k4f");

function createMockSigner(): TransactionSigner {
  return {
    address: VOUCHER_ADDRESS,
    signTransactions: async (transactions) => transactions,
  } as TransactionSigner;
}

function collectSignerRefs(request: ReturnType<typeof buildTransactionSendRequest>) {
  const instructionSigners = request.instructions[0].accounts
    .map((account) => ("signer" in account ? account.signer : undefined))
    .filter(Boolean);

  return [request.authority, ...instructionSigners];
}

describe("useReputationOracle send helpers", () => {
  it("preserves signer metadata when normalizing a vouch instruction", async () => {
    const signer = createMockSigner();
    const ix = await getVouchInstructionAsync({
      voucheeProfile: VOUCHEE_PROFILE,
      voucher: signer,
      stakeAmount: 1_000_000_000n,
    });

    const normalizedIx = normalizeInstructionForSend(ix);
    const voucherAccount = normalizedIx.accounts[4];

    expect(voucherAccount.address).toBe(VOUCHER_ADDRESS);
    expect("signer" in voucherAccount && voucherAccount.signer).toBe(signer);
    expect(voucherAccount).not.toBe(ix.accounts[4]);
  });

  it("uses the same signer instance for vouch instruction and send authority", async () => {
    const signer = createMockSigner();
    const ix = await getVouchInstructionAsync({
      voucheeProfile: VOUCHEE_PROFILE,
      voucher: signer,
      stakeAmount: 2_000_000_000n,
    });

    const request = buildTransactionSendRequest(ix, signer);
    const signers = collectSignerRefs(request);

    expect(signers).toHaveLength(2);
    expect(new Set(signers).size).toBe(1);
    expect(request.authority).toBe(signer);
  });

  it("uses the same signer instance for revoke instruction and send authority", async () => {
    const signer = createMockSigner();
    const ix = await getRevokeVouchInstructionAsync({
      voucheeProfile: VOUCHEE_PROFILE,
      voucher: signer,
    });

    const request = buildTransactionSendRequest(ix, signer);
    const signers = collectSignerRefs(request);

    expect(signers).toHaveLength(2);
    expect(new Set(signers).size).toBe(1);
    expect(request.authority).toBe(signer);
  });

  it("reports a configured-network balance mismatch before sending a vouch", () => {
    const error = getStakeClusterGuardError({
      action: "vouch",
      walletAddress: VOUCHER_ADDRESS,
      voucheeProfileExists: true,
      walletBalanceLamports: 0n,
      requiredLamports: 1_000_000_000n,
      configuredChainLabel: "Solana Devnet",
      configuredRpcTarget: "devnet",
    });

    expect(error).toContain("configured Solana Devnet (devnet RPC)");
    expect(error).toContain("This vouch needs about 1 SOL");
    expect(error).toContain("switch Phantom and the app to the same network");
  });

  it("reports a missing live vouch on the configured network before revoke", () => {
    const error = getStakeClusterGuardError({
      action: "revoke",
      walletAddress: VOUCHER_ADDRESS,
      voucheeProfileExists: true,
      hasLiveVouch: false,
      configuredChainLabel: "Solana",
      configuredRpcTarget: "mainnet",
    });

    expect(error).toContain("No live vouch for this author was found");
    expect(error).toContain("configured Solana (mainnet RPC)");
    expect(error).toContain("switch Phantom and the app to the same cluster");
  });

  it("does not block when the configured network state is coherent", () => {
    const error = getStakeClusterGuardError({
      action: "vouch",
      walletAddress: VOUCHER_ADDRESS,
      voucheeProfileExists: true,
      walletBalanceLamports: 2_000_000_000n,
      requiredLamports: 1_000_000_000n,
      configuredChainLabel: "Solana Devnet",
      configuredRpcTarget: "devnet",
    });

    expect(error).toBeNull();
  });
});
