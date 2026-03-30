import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { useMemo, useCallback } from "react";
import {
  address,
  createSolanaRpc,
  getAddressEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  isAddress,
  signature,
  type Address,
  type AccountMeta,
  type Instruction,
  type ReadonlyUint8Array,
  type TransactionSigner,
} from "@solana/kit";
import {
  createWalletTransactionSigner,
  type TransactionPrepareAndSendRequest,
} from "@solana/client";
import type { Base64EncodedBytes, Base58EncodedBytes } from "@solana/rpc-types";
import { decodeBase64, encodeBase64 } from "@/lib/base64";

const asBase64 = (bytes: Uint8Array) =>
  encodeBase64(bytes) as Base64EncodedBytes;
const asBase58 = (addr: string) => addr as unknown as Base58EncodedBytes;
import {
  fetchAllMaybePurchase,
  fetchMaybeAgentProfile,
  fetchMaybeAuthorDispute,
  fetchMaybePurchase,
  fetchMaybeReputationConfig,
  fetchMaybeSkillListing,
  fetchMaybeVouch,
  fetchVouch,
  getAuthorDisputeDecoder,
  getOpenAuthorDisputeInstructionAsync,
  getResolveAuthorDisputeInstructionAsync,
  getAgentProfileDecoder,
  getRegisterAgentInstructionAsync,
  getVouchInstructionAsync,
  getRevokeVouchInstructionAsync,
  getOpenDisputeInstructionAsync,
  getCreateSkillListingInstructionAsync,
  getUpdateSkillListingInstructionAsync,
  getPurchaseSkillInstructionAsync,
  getSkillListingDecoder,
  getVouchDecoder,
  getPurchaseDecoder,
  AGENT_PROFILE_DISCRIMINATOR,
  AUTHOR_DISPUTE_DISCRIMINATOR,
  SKILL_LISTING_DISCRIMINATOR,
  VOUCH_DISCRIMINATOR,
  PURCHASE_DISCRIMINATOR,
  AuthorDisputeReason,
  AuthorDisputeRuling,
  VouchStatus,
  type AuthorDispute,
  type AgentProfile,
  type ReputationConfig,
  type SkillListing,
  type Vouch as VouchAccount,
  type Purchase,
} from "../generated/reputation-oracle/src/generated";
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from "../generated/reputation-oracle/src/generated/programs";
import {
  getConfiguredSolanaChainDisplayLabel,
  getConfiguredSolanaRpcTargetLabel,
} from "@/lib/chains";
import {
  listAuthorDisputeLinks,
  listAuthorDisputesByAuthor,
  type AuthorDisputeRecord,
} from "@/lib/authorDisputes";
import { countsTowardAuthorWideReportSnapshot } from "@/lib/disputes";
import {
  assessPurchasePreflight,
  createPurchasePreflightContext,
  type PurchasePreflightAssessment,
} from "@/lib/purchasePreflight";
import { wrapRpcLookupError } from "@/lib/rpcErrors";

const LAMPORTS_PER_SOL = 1_000_000_000n;
const ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const rpc = createSolanaRpc(ENDPOINT);
const SIGNATURE_CONFIRMATION_TIMEOUT_MS = 45_000;
const SIGNATURE_CONFIRMATION_POLL_MS = 1_000;

const textEncoder = getUtf8Encoder();
const addressEncoder = getAddressEncoder();

type SendInstructionAccount = {
  address: Address;
  role: number;
  signer?: TransactionSigner;
};

type SendInstruction = Instruction<string, readonly AccountMeta[]> & {
  data?: ReadonlyUint8Array;
  accounts: readonly SendInstructionAccount[];
};

export function normalizeInstructionForSend(ix: SendInstruction): SendInstruction {
  return {
    programAddress: ix.programAddress,
    data: ix.data,
    accounts: ix.accounts.map((acc) => ({
      address: acc.address,
      role: acc.role,
      ...("signer" in acc && acc.signer ? { signer: acc.signer } : {}),
    })),
  } as SendInstruction;
}

export function buildTransactionSendRequest(
  ix: SendInstruction,
  authority: TransactionSigner
): TransactionPrepareAndSendRequest {
  return {
    instructions: [normalizeInstructionForSend(ix)],
    authority,
  };
}

type StakeClusterGuardAssessment =
  | {
      action: "vouch";
      walletAddress: Address;
      voucheeProfileExists: boolean;
      walletBalanceLamports: bigint | null;
      requiredLamports: bigint;
      configuredChainLabel?: string;
      configuredRpcTarget?: string;
    }
  | {
      action: "revoke";
      walletAddress: Address;
      voucheeProfileExists: boolean;
      hasLiveVouch: boolean;
      configuredChainLabel?: string;
      configuredRpcTarget?: string;
    };

export function getStakeClusterGuardError(
  assessment: StakeClusterGuardAssessment
): string | null {
  const configuredChainLabel =
    assessment.configuredChainLabel ?? getConfiguredSolanaChainDisplayLabel();
  const configuredRpcTarget =
    assessment.configuredRpcTarget ?? getConfiguredSolanaRpcTargetLabel();
  const configuredNetwork = `${configuredChainLabel} (${configuredRpcTarget} RPC)`;

  if (!assessment.voucheeProfileExists) {
    return `This author is not registered on the configured ${configuredNetwork}. If you expected to interact with them on another network, switch Phantom and the app to the same cluster and retry.`;
  }

  if (assessment.action === "vouch") {
    if (
      assessment.walletBalanceLamports !== null &&
      assessment.walletBalanceLamports < assessment.requiredLamports
    ) {
      return `Connected wallet ${shortAddress(
        assessment.walletAddress
      )} has ${formatLamportsAsSol(
        assessment.walletBalanceLamports
      )} SOL on the configured ${configuredNetwork}. This vouch needs about ${formatLamportsAsSol(
        assessment.requiredLamports
      )} SOL plus network fees. If Phantom shows a different balance, switch Phantom and the app to the same network and retry.`;
    }
    return null;
  }

  if (!assessment.hasLiveVouch) {
    return `No live vouch for this author was found on the configured ${configuredNetwork}. If you created the vouch on another network, switch Phantom and the app to the same cluster and retry.`;
  }

  return null;
}

class StakeClusterGuardError extends Error {}

function encodeU64LE(value: number | bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
}

async function deriveAddress(
  seeds: (string | Address)[],
  programId: Address = REPUTATION_ORACLE_PROGRAM_ADDRESS
): Promise<Address> {
  const encodedSeeds = seeds.map((s) =>
    isAddress(s) ? addressEncoder.encode(s) : textEncoder.encode(s)
  );
  const [derived] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: encodedSeeds,
  });
  return derived;
}

async function getAgentPDA(agentKey: Address): Promise<Address> {
  return deriveAddress(["agent", agentKey]);
}

async function getVouchPDA(
  voucherProfile: Address,
  voucheeProfile: Address
): Promise<Address> {
  return deriveAddress(["vouch", voucherProfile, voucheeProfile]);
}

async function getConfigPDA(): Promise<Address> {
  return deriveAddress(["config"]);
}

async function getAuthorDisputePDA(
  author: Address,
  disputeId: number | bigint
): Promise<Address> {
  const [derived] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: [
      textEncoder.encode("author_dispute"),
      addressEncoder.encode(author),
      encodeU64LE(disputeId),
    ],
  });
  return derived;
}

async function getAuthorDisputeVouchLinkPDA(
  authorDispute: Address,
  vouch: Address
): Promise<Address> {
  const [derived] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: [
      textEncoder.encode("author_dispute_vouch_link"),
      addressEncoder.encode(authorDispute),
      addressEncoder.encode(vouch),
    ],
  });
  return derived;
}

async function getSkillListingPDA(
  author: Address,
  skillId: string
): Promise<Address> {
  const encodedSeeds = [
    textEncoder.encode("skill"),
    addressEncoder.encode(author),
    textEncoder.encode(skillId),
  ];
  const [derived] = await getProgramDerivedAddress({
    programAddress: REPUTATION_ORACLE_PROGRAM_ADDRESS,
    seeds: encodedSeeds,
  });
  return derived;
}

async function getPurchasePDA(
  buyer: Address,
  skillListing: Address
): Promise<Address> {
  return deriveAddress(["purchase", buyer, skillListing]);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortAddress(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatLamportsAsSol(lamports: bigint) {
  const sol = Number(lamports) / Number(LAMPORTS_PER_SOL);
  const decimals = sol >= 1 ? 4 : 6;
  return sol.toFixed(decimals).replace(/\.?0+$/, "");
}

function coerceLamports(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    (value as { value?: unknown }).value !== undefined
  ) {
    return coerceLamports((value as { value: unknown }).value);
  }
  throw new Error("Unexpected lamports response from RPC");
}

async function estimatePurchasePreflight(
  buyer: Address,
  skillListing: Address,
  author: Address
): Promise<PurchasePreflightAssessment> {
  const listing = await fetchMaybeSkillListing(rpc, skillListing);
  if (!listing.exists) throw new Error("Skill listing not found on-chain");
  const context = await createPurchasePreflightContext({
    rpc,
    buyer,
    authors: [author],
  });
  return assessPurchasePreflight({
    context,
    priceLamports: BigInt(listing.data.priceLamports),
    author,
  });
}

function buildPurchaseBalanceError(
  walletAddress: Address,
  estimate: PurchasePreflightAssessment
) {
  const configuredNetwork = `${getConfiguredSolanaChainDisplayLabel()} (${getConfiguredSolanaRpcTargetLabel()} RPC)`;
  return `Connected wallet ${shortAddress(
    walletAddress
  )} has ${formatLamportsAsSol(
    estimate.buyerBalanceLamports ?? 0n
  )} SOL on the configured ${configuredNetwork}. Buying this skill needs about ${formatLamportsAsSol(
    estimate.estimatedBuyerTotalLamports
  )} SOL including rent for the purchase record.`;
}

function buildPurchaseClusterMismatchError(
  walletAddress: Address,
  estimate: PurchasePreflightAssessment
) {
  const configuredNetwork = `${getConfiguredSolanaChainDisplayLabel()} (${getConfiguredSolanaRpcTargetLabel()} RPC)`;
  return `Phantom reported insufficient SOL, but connected wallet ${shortAddress(
    walletAddress
  )} has ${formatLamportsAsSol(
    estimate.buyerBalanceLamports ?? 0n
  )} SOL on the configured ${configuredNetwork}. If Phantom shows a different balance, switch Phantom and the app to the same network and retry.`;
}

function isLiveVouchStatus(status: VouchStatus): boolean {
  return status === VouchStatus.Active || status === VouchStatus.Vindicated;
}

async function getWalletBalanceLamports(walletAddress: Address): Promise<bigint> {
  const response = await rpc.getBalance(walletAddress).send();
  return coerceLamports(response.value);
}

async function assertStakeActionClusterReady(
  input:
    | {
        action: "vouch";
        walletAddress: Address;
        voucheeProfile: Address;
        requiredLamports: bigint;
      }
    | {
        action: "revoke";
        walletAddress: Address;
        voucheeProfile: Address;
      }
) {
  try {
    const voucheeProfileAccountPromise = fetchMaybeAgentProfile(
      rpc,
      input.voucheeProfile
    ).catch(() => null);

    if (input.action === "vouch") {
      const [voucheeProfileAccount, walletBalanceLamports] = await Promise.all([
        voucheeProfileAccountPromise,
        getWalletBalanceLamports(input.walletAddress).catch(() => null),
      ]);

      const guardError = getStakeClusterGuardError({
        action: "vouch",
        walletAddress: input.walletAddress,
        voucheeProfileExists: !!voucheeProfileAccount?.exists,
        walletBalanceLamports,
        requiredLamports: input.requiredLamports,
      });
      if (guardError) throw new StakeClusterGuardError(guardError);
      return;
    }

    const voucherProfile = await getAgentPDA(input.walletAddress);
    const vouchAddress = await getVouchPDA(voucherProfile, input.voucheeProfile);
    const [voucheeProfileAccount, maybeVouch] = await Promise.all([
      voucheeProfileAccountPromise,
      fetchMaybeVouch(rpc, vouchAddress).catch(() => null),
    ]);

    const guardError = getStakeClusterGuardError({
      action: "revoke",
      walletAddress: input.walletAddress,
      voucheeProfileExists: !!voucheeProfileAccount?.exists,
      hasLiveVouch:
        !!maybeVouch?.exists && isLiveVouchStatus(maybeVouch.data.status),
    });
    if (guardError) throw new StakeClusterGuardError(guardError);
  } catch (error) {
    if (error instanceof StakeClusterGuardError) throw error;
    console.warn("Stake cluster guard skipped:", error);
  }
}

async function waitForConfirmedSignature(
  txSignature: ReturnType<typeof signature>
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SIGNATURE_CONFIRMATION_TIMEOUT_MS) {
    const response = await rpc
      .getSignatureStatuses([txSignature], { searchTransactionHistory: true })
      .send();
    const status = response.value[0];

    if (status?.err) {
      throw new Error(
        `Transaction ${txSignature} failed on-chain: ${JSON.stringify(
          status.err
        )}`
      );
    }

    if (
      status &&
      (status.confirmationStatus === "confirmed" ||
        status.confirmationStatus === "finalized")
    ) {
      return;
    }

    await sleep(SIGNATURE_CONFIRMATION_POLL_MS);
  }

  throw new Error(
    `Transaction ${txSignature} was sent but not confirmed within ${
      SIGNATURE_CONFIRMATION_TIMEOUT_MS / 1000
    } seconds.`
  );
}

export function useReputationOracle() {
  const { wallet, status } = useWalletConnection();
  const connected = status === "connected" && wallet;
  const { send: frameworkSend } = useSendTransaction();

  const walletAddress: Address | null = connected
    ? (wallet.account.address as Address)
    : null;

  const signer: TransactionSigner | null = useMemo(() => {
    if (!connected || !wallet) return null;
    return createWalletTransactionSigner(wallet).signer;
  }, [connected, wallet]);

  const sendIx = useCallback(
    async (ix: any) => {
      if (!walletAddress || !signer) throw new Error("Wallet not connected");
      const request = buildTransactionSendRequest(ix, signer);
      try {
        const sig = await frameworkSend(request);
        const txSignature = signature(String(sig));
        await waitForConfirmedSignature(txSignature);
        return txSignature;
      } catch (err: any) {
        const cause = err?.cause ?? err;
        const logs = cause?.logs ?? cause?.context?.logs;
        if (logs?.length) console.error("Simulation logs:", logs);
        if (cause) {
          console.error("Transaction failed (cause):", cause);
          throw cause;
        }
        throw err;
      }
    },
    [walletAddress, signer, frameworkSend]
  );

  const registerAgent = useCallback(
    async (metadataUri: string) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");
      const ix = await getRegisterAgentInstructionAsync({
        authority: signer,
        metadataUri,
      });
      const tx = await sendIx(ix);
      const agentProfile = await getAgentPDA(walletAddress);
      return { tx, agentProfile };
    },
    [signer, walletAddress, sendIx]
  );

  const vouch = useCallback(
    async (voucheeKey: Address, amount: number) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");
      const voucheeProfile = await getAgentPDA(voucheeKey);
      const stakeAmount = BigInt(Math.round(amount * Number(LAMPORTS_PER_SOL)));
      await assertStakeActionClusterReady({
        action: "vouch",
        walletAddress,
        voucheeProfile,
        requiredLamports: stakeAmount,
      });
      const ix = await getVouchInstructionAsync({
        voucheeProfile,
        voucher: signer,
        stakeAmount,
      });
      return { tx: await sendIx(ix) };
    },
    [signer, walletAddress, sendIx]
  );

  const revokeVouch = useCallback(
    async (voucheeKey: Address) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");
      const voucheeProfile = await getAgentPDA(voucheeKey);
      await assertStakeActionClusterReady({
        action: "revoke",
        walletAddress,
        voucheeProfile,
      });
      const ix = await getRevokeVouchInstructionAsync({
        voucheeProfile,
        voucher: signer,
      });
      return { tx: await sendIx(ix) };
    },
    [signer, walletAddress, sendIx]
  );

  const openDispute = useCallback(
    async (vouchAccount: Address, evidence: string) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");
      const ix = await getOpenDisputeInstructionAsync({
        vouch: vouchAccount,
        challenger: signer,
        evidenceUri: evidence,
      });
      return { tx: await sendIx(ix) };
    },
    [signer, walletAddress, sendIx]
  );

  const getConfig = useCallback(async (): Promise<ReputationConfig | null> => {
    try {
      const configPda = await getConfigPDA();
      const account = await fetchMaybeReputationConfig(rpc, configPda);
      if (!account.exists) return null;
      return account.data;
    } catch {
      return null;
    }
  }, []);

  const getAuthorDisputeByAddress = useCallback(
    async (disputeAddress: Address) => {
      try {
        const account = await fetchMaybeAuthorDispute(rpc, disputeAddress);
        if (!account.exists) return null;
        return account.data;
      } catch {
        return null;
      }
    },
    []
  );

  const getAuthorDisputesByAuthor = useCallback(async (authorKey: Address) => {
    return listAuthorDisputesByAuthor(String(authorKey));
  }, []);

  const getAuthorDisputeLinks = useCallback(
    async (authorDisputeAddress: Address) => {
      return listAuthorDisputeLinks(String(authorDisputeAddress));
    },
    []
  );

  const getAllAuthorDisputes = useCallback(async () => {
    try {
      const accounts = await rpc
        .getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            {
              memcmp: {
                offset: 0n,
                bytes: asBase64(AUTHOR_DISPUTE_DISCRIMINATOR),
                encoding: "base64",
              },
            },
          ],
        })
        .send();
      const decoder = getAuthorDisputeDecoder();
      const records = accounts.map((account) => ({
        publicKey: account.pubkey,
        account: decoder.decode(decodeBase64(account.account.data[0])),
      }));
      const linkedVouchesByDispute = new Map<string, string[]>();
      await Promise.all(
        records.map(async (record) => {
          const linkedVouches = await listAuthorDisputeLinks(record.publicKey);
          linkedVouchesByDispute.set(record.publicKey, linkedVouches);
        })
      );
      return records
        .map((record) => {
          const reasonLabel =
            AuthorDisputeReason[record.account.reason] ?? "Unknown";
          const statusLabel = record.account.status === 0 ? "Open" : "Resolved";
          const rulingOption = record.account.ruling as unknown as
            | { __option?: "Some" | "None"; value?: AuthorDisputeRuling }
            | null
            | undefined;
          const rulingValue =
            rulingOption && rulingOption.__option === "Some"
              ? rulingOption.value ?? null
              : null;
          const rulingLabel =
            rulingValue === null || rulingValue === undefined
              ? null
              : AuthorDisputeRuling[rulingValue] ?? "Unknown";
          return {
            publicKey: record.publicKey,
            account: record.account,
            linkedVouches: linkedVouchesByDispute.get(record.publicKey) ?? [],
            reasonLabel,
            statusLabel,
            rulingLabel,
          };
        })
        .sort(
          (a, b) => Number(b.account.createdAt) - Number(a.account.createdAt)
        );
    } catch (error) {
      console.error("Error fetching author disputes:", error);
      return [];
    }
  }, []);

  const resolveAuthorDispute = useCallback(
    async (
      authorKey: Address,
      disputeId: number | bigint,
      ruling: AuthorDisputeRuling,
      challenger: Address
    ) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");
      const authorProfile = await getAgentPDA(authorKey);
      const authorDispute = await getAuthorDisputePDA(authorKey, disputeId);
      const ix = await getResolveAuthorDisputeInstructionAsync({
        authorDispute,
        authorProfile,
        authority: signer,
        challenger,
        disputeId,
        ruling,
      });
      if (ruling !== AuthorDisputeRuling.Upheld) {
        return { tx: await sendIx(ix), authorDispute };
      }

      const linkedVouches = await listAuthorDisputeLinks(String(authorDispute));
      const settlementAccounts = (
        await Promise.all(
          linkedVouches.map(async (linkedVouch) => {
            const vouchAddress = address(linkedVouch);
            const authorDisputeVouchLink = await getAuthorDisputeVouchLinkPDA(
              authorDispute,
              vouchAddress
            );
            const vouch = await fetchVouch(rpc, vouchAddress);
            return [
              { address: authorDisputeVouchLink, role: 0 },
              { address: vouchAddress, role: 1 },
              { address: vouch.data.voucher, role: 1 },
            ];
          })
        )
      ).flat();

      return {
        tx: await sendIx({
          ...ix,
          accounts: [...ix.accounts, ...settlementAccounts],
        }),
        authorDispute,
      };
    },
    [signer, walletAddress, sendIx]
  );

  const getAgentProfileByAddress = useCallback(
    async (profileAddress: Address) => {
      try {
        const account = await fetchMaybeAgentProfile(rpc, profileAddress);
        if (!account.exists) return null;
        return account.data;
      } catch {
        return null;
      }
    },
    []
  );

  const getAgentProfile = useCallback(
    async (agentKey: Address) => {
      const pda = await getAgentPDA(agentKey);
      return getAgentProfileByAddress(pda);
    },
    [getAgentProfileByAddress]
  );

  const getAllAgents = useCallback(async () => {
    try {
      const accounts = await rpc
        .getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            {
              memcmp: {
                offset: 0n,
                bytes: asBase64(AGENT_PROFILE_DISCRIMINATOR),
                encoding: "base64",
              },
            },
          ],
        })
        .send();
      const decoder = getAgentProfileDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(decodeBase64(a.account.data[0])),
      }));
    } catch (e) {
      console.error("Error fetching all agents:", e);
      return [];
    }
  }, []);

  const getAllVouchesForAgent = useCallback(async (agentKey: Address) => {
    try {
      const agentProfile = await getAgentPDA(agentKey);
      const accounts = await rpc
        .getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            {
              memcmp: {
                offset: 0n,
                bytes: asBase64(VOUCH_DISCRIMINATOR),
                encoding: "base64",
              },
            },
            {
              memcmp: {
                offset: 8n,
                bytes: asBase58(agentProfile),
                encoding: "base58",
              },
            },
          ],
        })
        .send();
      const decoder = getVouchDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(decodeBase64(a.account.data[0])),
      }));
    } catch {
      return [];
    }
  }, []);

  const getAllVouchesReceivedByAgent = useCallback(
    async (agentKey: Address) => {
      try {
        const agentProfile = await getAgentPDA(agentKey);
        const accounts = await rpc
          .getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
            encoding: "base64",
            filters: [
              {
                memcmp: {
                  offset: 0n,
                  bytes: asBase64(VOUCH_DISCRIMINATOR),
                  encoding: "base64",
                },
              },
              {
                memcmp: {
                  offset: 40n,
                  bytes: asBase58(agentProfile),
                  encoding: "base58",
                },
              },
            ],
          })
          .send();
        const decoder = getVouchDecoder();
        return accounts.map((a) => ({
          publicKey: a.pubkey,
          account: decoder.decode(decodeBase64(a.account.data[0])),
        }));
      } catch {
        return [];
      }
    },
    []
  );

  const getAllSkillListings = useCallback(async () => {
    try {
      const accounts = await rpc
        .getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            {
              memcmp: {
                offset: 0n,
                bytes: asBase64(SKILL_LISTING_DISCRIMINATOR),
                encoding: "base64",
              },
            },
          ],
        })
        .send();
      const decoder = getSkillListingDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(decodeBase64(a.account.data[0])),
      }));
    } catch (e) {
      console.error("Error fetching skill listings:", e);
      return [];
    }
  }, []);

  const getSkillListingsByAuthor = useCallback(async (author: Address) => {
    try {
      const accounts = await rpc
        .getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            {
              memcmp: {
                offset: 0n,
                bytes: asBase64(SKILL_LISTING_DISCRIMINATOR),
                encoding: "base64",
              },
            },
            {
              memcmp: {
                offset: 8n,
                bytes: asBase58(author),
                encoding: "base58",
              },
            },
          ],
        })
        .send();
      const decoder = getSkillListingDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(decodeBase64(a.account.data[0])),
      }));
    } catch {
      return [];
    }
  }, []);

  const getAllPurchases = useCallback(async () => {
    try {
      const accounts = await rpc
        .getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            {
              memcmp: {
                offset: 0n,
                bytes: asBase64(PURCHASE_DISCRIMINATOR),
                encoding: "base64",
              },
            },
          ],
        })
        .send();
      const decoder = getPurchaseDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(decodeBase64(a.account.data[0])),
      }));
    } catch {
      return [];
    }
  }, []);

  const getPurchasesByBuyer = useCallback(async (buyer: Address) => {
    try {
      const accounts = await rpc
        .getProgramAccounts(REPUTATION_ORACLE_PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            {
              memcmp: {
                offset: 0n,
                bytes: asBase64(PURCHASE_DISCRIMINATOR),
                encoding: "base64",
              },
            },
            {
              memcmp: {
                offset: 8n,
                bytes: asBase58(buyer),
                encoding: "base58",
              },
            },
          ],
        })
        .send();
      const decoder = getPurchaseDecoder();
      return accounts.map((a) => ({
        publicKey: a.pubkey,
        account: decoder.decode(decodeBase64(a.account.data[0])),
      }));
    } catch (error) {
      console.error("Error fetching purchases by buyer:", error);
      throw wrapRpcLookupError(error, "Failed to fetch purchases by buyer");
    }
  }, []);

  const getPurchasedSkillListingKeys = useCallback(
    async (buyer: Address, skillListings: Address[]) => {
      if (skillListings.length === 0) return new Set<string>();
      try {
        const purchaseAddresses = await Promise.all(
          skillListings.map((skillListing) => getPurchasePDA(buyer, skillListing))
        );
        const maybePurchases = await fetchAllMaybePurchase(rpc, purchaseAddresses);

        return new Set(
          skillListings
            .filter((_, index) => maybePurchases[index]?.exists)
            .map((skillListing) => String(skillListing))
        );
      } catch (error) {
        console.error("Error resolving purchased skill flags:", error);
        throw wrapRpcLookupError(
          error,
          "Failed to resolve purchased skill flags"
        );
      }
    },
    []
  );

  const openAuthorDispute = useCallback(
    async (
      authorKey: Address,
      params: {
        reason: AuthorDisputeReason;
        evidenceUri: string;
        skillListing?: Address;
        purchase?: Address;
        disputeId?: number | bigint;
      }
    ) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");

      const authorProfile = await getAgentPDA(authorKey);
      const disputeId = params.disputeId ?? BigInt(Date.now());
      const authorDispute = await getAuthorDisputePDA(authorKey, disputeId);
      const backingVouches = (
        await getAllVouchesReceivedByAgent(authorKey)
      ).filter((vouch) =>
        countsTowardAuthorWideReportSnapshot(vouch.account.status)
      );
      const uniqueBackingVouches = [
        ...new Set(backingVouches.map((vouch) => vouch.publicKey)),
      ].map((vouch) => address(vouch));
      const openIx = await getOpenAuthorDisputeInstructionAsync({
        authorDispute,
        authorProfile,
        challenger: signer,
        disputeId,
        reason: params.reason,
        evidenceUri: params.evidenceUri,
        skillListing: params.skillListing,
        purchase: params.purchase,
      });
      const remainingAccounts = await Promise.all(
        uniqueBackingVouches.map(async (vouch) => {
          const authorDisputeVouchLink = await getAuthorDisputeVouchLinkPDA(
            authorDispute,
            vouch
          );
          return [
            { address: authorDisputeVouchLink, role: 1 },
            { address: vouch, role: 0 },
          ];
        })
      );
      const tx = await sendIx({
        ...openIx,
        accounts: [...openIx.accounts, ...remainingAccounts.flat()],
      });

      return {
        tx,
        authorDispute,
        disputeId,
        linkedVouches: uniqueBackingVouches,
      };
    },
    [getAllVouchesReceivedByAgent, signer, walletAddress, sendIx]
  );

  const createSkillListing = useCallback(
    async (
      skillId: string,
      skillUri: string,
      name: string,
      description: string,
      priceLamports: number
    ) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");
      const ix = await getCreateSkillListingInstructionAsync({
        author: signer,
        skillId,
        skillUri,
        name,
        description,
        priceLamports: BigInt(priceLamports),
      });
      return { tx: await sendIx(ix) };
    },
    [signer, walletAddress, sendIx]
  );

  const updateSkillListing = useCallback(
    async (
      skillId: string,
      skillUri: string,
      name: string,
      description: string,
      priceLamports: number
    ) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");
      const ix = await getUpdateSkillListingInstructionAsync({
        author: signer,
        skillId,
        skillUri,
        name,
        description,
        priceLamports: BigInt(priceLamports),
      });
      return { tx: await sendIx(ix) };
    },
    [signer, walletAddress, sendIx]
  );

  const purchaseSkill = useCallback(
    async (skillListingKey: Address, authorKey: Address) => {
      if (!signer || !walletAddress) throw new Error("Wallet not connected");
      const purchasePda = await getPurchasePDA(walletAddress, skillListingKey);
      const existingPurchase = await fetchMaybePurchase(rpc, purchasePda).catch(
        () => null
      );
      if (existingPurchase?.exists) {
        return {
          tx: null,
          alreadyPurchased: true,
          purchase: purchasePda,
        };
      }
      let purchaseEstimate: PurchasePreflightAssessment | null = null;
      try {
        purchaseEstimate = await estimatePurchasePreflight(
          walletAddress,
          skillListingKey,
          authorKey
        );
        if (
          purchaseEstimate.purchasePreflightStatus === "buyerInsufficientBalance"
        ) {
          throw new Error(buildPurchaseBalanceError(walletAddress, purchaseEstimate));
        }
        if (
          purchaseEstimate.purchasePreflightStatus === "authorPayoutRentBlocked"
        ) {
          throw new Error(
            purchaseEstimate.purchasePreflightMessage ??
              "This listing is temporarily not purchasable."
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("Buying this skill needs about") ||
            error.message.includes("cannot currently be purchased"))
        ) {
          throw error;
        }
        console.warn("Purchase preflight skipped:", error);
      }

      const authorProfile = await getAgentPDA(authorKey);
      const ix = await getPurchaseSkillInstructionAsync({
        skillListing: skillListingKey,
        author: authorKey,
        authorProfile,
        buyer: signer,
      });
      try {
        return { tx: await sendIx(ix) };
      } catch (error: any) {
        const existingPurchaseAfterFailure = await fetchMaybePurchase(
          rpc,
          purchasePda
        ).catch(() => null);
        if (existingPurchaseAfterFailure?.exists) {
          return {
            tx: null,
            alreadyPurchased: true,
            purchase: purchasePda,
          };
        }
        const message = String(error?.message ?? error ?? "");
        if (/insufficient|not enough sol/i.test(message)) {
          const latestEstimate =
            purchaseEstimate ??
            (await estimatePurchasePreflight(
              walletAddress,
              skillListingKey,
              authorKey
            ).catch(() => null));
          if (latestEstimate) {
            if (
              latestEstimate.purchasePreflightStatus ===
              "buyerInsufficientBalance"
            ) {
              throw new Error(
                buildPurchaseBalanceError(walletAddress, latestEstimate)
              );
            }
            if (
              latestEstimate.purchasePreflightStatus ===
              "authorPayoutRentBlocked"
            ) {
              throw new Error(
                latestEstimate.purchasePreflightMessage ??
                  "This listing is temporarily not purchasable."
              );
            }
            throw new Error(
              buildPurchaseClusterMismatchError(walletAddress, latestEstimate)
            );
          }
        }
        throw error;
      }
    },
    [signer, walletAddress, sendIx]
  );

  return useMemo(
    () => ({
      connected: !!connected,
      walletAddress,
      registerAgent,
      vouch,
      revokeVouch,
      openDispute,
      openAuthorDispute,
      resolveAuthorDispute,
      getConfig,
      getAgentProfile,
      getAgentProfileByAddress,
      getAuthorDisputeByAddress,
      getAuthorDisputesByAuthor,
      getAuthorDisputeLinks,
      getAllAuthorDisputes,
      getAllVouchesForAgent,
      getAllVouchesReceivedByAgent,
      getAllAgents,
      getAllSkillListings,
      getSkillListingsByAuthor,
      getAllPurchases,
      getPurchasesByBuyer,
      getPurchasedSkillListingKeys,
      createSkillListing,
      updateSkillListing,
      purchaseSkill,
      getAgentPDA,
      getVouchPDA,
      getConfigPDA,
      getAuthorDisputePDA,
      getAuthorDisputeVouchLinkPDA,
      getSkillListingPDA,
      getPurchasePDA,
    }),
    [
      connected,
      walletAddress,
      registerAgent,
      vouch,
      revokeVouch,
      openDispute,
      openAuthorDispute,
      resolveAuthorDispute,
      getConfig,
      getAgentProfile,
      getAgentProfileByAddress,
      getAuthorDisputeByAddress,
      getAuthorDisputesByAuthor,
      getAuthorDisputeLinks,
      getAllAuthorDisputes,
      getAllVouchesForAgent,
      getAllVouchesReceivedByAgent,
      getAllAgents,
      getAllSkillListings,
      getSkillListingsByAuthor,
      getAllPurchases,
      getPurchasesByBuyer,
      getPurchasedSkillListingKeys,
      createSkillListing,
      updateSkillListing,
      purchaseSkill,
    ]
  );
}
