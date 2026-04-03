import { sql } from "@/lib/db";
import { resolveAgentIdentityByWallet } from "@/lib/agentIdentity";
import { resolveAuthorTrust } from "@/lib/trust";
import { getOnChainPrice } from "@/lib/onchain";
import {
  getConfiguredSolanaChainContext,
  normalizePersistedChainContext,
} from "@/lib/chains";
import { createSolanaRpc } from "@solana/kit";
import type { Base64EncodedBytes } from "@solana/rpc-types";
import {
  getSkillListingDecoder,
  SKILL_LISTING_DISCRIMINATOR,
} from "../generated/reputation-oracle/src/generated";
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from "../generated/reputation-oracle/src/generated/programs";
import { buildAgentTrustSummary } from "@/lib/agentDiscovery";
import { truncateDescription } from "@/lib/site";

const CHAIN_PREFIX = "chain-";
const rpc = createSolanaRpc(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
);
const configuredSolanaChainContext = getConfiguredSolanaChainContext();
const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64") as Base64EncodedBytes;

type SkillRow = {
  id: string;
  author_pubkey: string;
  skill_id: string;
  name: string;
  description: string | null;
  chain_context: string | null;
  on_chain_address: string | null;
  price_lamports?: number;
};

export async function getSkillMetadataSummary(id: string) {
  if (id.startsWith(CHAIN_PREFIX)) {
    const onChainAddr = id.slice(CHAIN_PREFIX.length);
    const listing = await fetchChainSkill(onChainAddr);
    if (!listing) return null;

    const trust = await resolveAuthorTrust(String(listing.data.author));
    const identity = await resolveAgentIdentityByWallet(
      String(listing.data.author),
      {
        hasAgentProfile: trust.isRegistered,
      }
    ).catch(() => null);
    const trustSummary = buildAgentTrustSummary({
      walletPubkey: String(listing.data.author),
      trust,
      identity,
    });

    return {
      id: `${CHAIN_PREFIX}${listing.pubkey}`,
      name: listing.data.name,
      description:
        listing.data.description ||
        "View on-chain trust signals, stake-backed endorsements, and dispute history before installing this agent skill.",
      authorPubkey: String(listing.data.author),
      chainContext: configuredSolanaChainContext,
      priceLamports: Number(listing.data.priceLamports),
      trustSummary,
    };
  }

  const rows = await sql()<SkillRow>`
    SELECT id, author_pubkey, skill_id, name, description, chain_context, on_chain_address, price_lamports
    FROM skills
    WHERE id = ${id}::uuid
    LIMIT 1
  `.catch(() => []);
  const skill = rows[0];
  if (!skill) return null;

  const trust = await resolveAuthorTrust(skill.author_pubkey);
  const identity = await resolveAgentIdentityByWallet(skill.author_pubkey, {
    hasAgentProfile: trust.isRegistered,
  }).catch(() => null);
  const trustSummary = buildAgentTrustSummary({
    walletPubkey: skill.author_pubkey,
    trust,
    identity,
  });

  let priceLamports = skill.price_lamports ?? 0;
  if (skill.on_chain_address) {
    const listing = await getOnChainPrice(skill.on_chain_address).catch(
      () => null
    );
    if (listing) priceLamports = listing.price;
  }

  return {
    id: skill.id,
    name: skill.name,
    description:
      skill.description ||
      "Inspect the author trust record, stake-backed vouches, and dispute history behind this AI agent skill.",
    authorPubkey: skill.author_pubkey,
    chainContext: normalizePersistedChainContext(skill.chain_context),
    priceLamports,
    trustSummary,
  };
}

export async function getAuthorMetadataSummary(pubkey: string) {
  const trust = await resolveAuthorTrust(pubkey);
  const identity = await resolveAgentIdentityByWallet(pubkey, {
    hasAgentProfile: trust.isRegistered,
  }).catch(() => null);
  const trustSummary = buildAgentTrustSummary({
    walletPubkey: pubkey,
    trust,
    identity,
  });

  const rows = await sql()<{
    published_skills: number;
  }>`
    SELECT COUNT(*)::int AS published_skills
    FROM skills
    WHERE author_pubkey = ${pubkey}
  `.catch(() => []);

  const publishedSkills = rows[0]?.published_skills ?? 0;
  const displayName = identity?.displayName || pubkey;
  const description = truncateDescription(
    `${displayName} has ${trust.totalVouchesReceived} vouches, ${trust.activeDisputesAgainstAuthor} active disputes, and ${publishedSkills} published skills on AgentVouch.`
  );

  return {
    pubkey,
    displayName,
    description,
    trustSummary,
    publishedSkills,
  };
}

async function fetchChainSkill(pubkey: string) {
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

  for (const account of accounts) {
    if (account.pubkey !== pubkey) continue;
    const data = decoder.decode(
      new Uint8Array(Buffer.from(account.account.data[0], "base64"))
    );
    return { pubkey: account.pubkey, data };
  }

  return null;
}
