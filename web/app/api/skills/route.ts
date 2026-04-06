import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase, sql } from "@/lib/db";
import { verifyAuthorTrust, resolveMultipleAuthorTrust } from "@/lib/trust";
import { verifyWalletSignature, type AuthPayload } from "@/lib/auth";
import { pinSkillContent } from "@/lib/ipfs";
import {
  resolveManyAgentIdentitiesByWallet,
  upsertLocalAgentIdentity,
} from "@/lib/agentIdentity";
import { buildAgentTrustSummary } from "@/lib/agentDiscovery";
import {
  getConfiguredSolanaChainContext,
  normalizeInputChainContext,
  normalizePersistedChainContext,
} from "@/lib/chains";
import {
  normalizeSkillContact,
  normalizeSkillDescription,
  normalizeSkillName,
} from "@/lib/skillDraft";
import {
  assessPurchasePreflight,
  createPurchasePreflightContext,
  serializePurchasePreflight,
} from "@/lib/purchasePreflight";
import {
  buildPublicCacheControl,
  PRIVATE_NO_STORE_CACHE_CONTROL,
  PUBLIC_ROUTE_CACHE_SECONDS,
  PUBLIC_ROUTE_STALE_SECONDS,
} from "@/lib/cachePolicy";
import { getErrorMessage } from "@/lib/errors";
import { listOnChainSkillListings } from "@/lib/onchain";
import { DEFAULT_SOLANA_RPC_URL } from "@/lib/solanaRpc";
import { address, createSolanaRpc, isAddress } from "@solana/kit";

const PAGE_SIZE = 20;
const rpc = createSolanaRpc(DEFAULT_SOLANA_RPC_URL);
const configuredSolanaChainContext = getConfiguredSolanaChainContext();

type RepoSkillRow = {
  id: string;
  skill_id: string;
  author_pubkey: string;
  name: string;
  description: string | null;
  tags: string[];
  current_version: number;
  ipfs_cid: string | null;
  on_chain_address: string | null;
  skill_uri?: string | null;
  chain_context: string | null;
  total_installs: number;
  total_downloads?: number | null;
  total_revenue?: number | null;
  price_lamports?: number | null;
  contact?: string | null;
  created_at: string;
  updated_at: string;
};

type ChainSkillRow = Omit<
  RepoSkillRow,
  | "on_chain_address"
  | "chain_context"
  | "total_downloads"
  | "total_revenue"
  | "price_lamports"
  | "skill_uri"
> & {
  on_chain_address: string;
  chain_context: string;
  total_downloads: number;
  total_revenue: number;
  price_lamports: number;
  skill_uri: string | null;
  source: "chain";
};

type RepoMergedSkillRow = RepoSkillRow & { source: "repo" };
type MergedSkillRow = RepoMergedSkillRow | ChainSkillRow;

async function fetchOnChainListings(): Promise<ChainSkillRow[]> {
  try {
    const listings = await listOnChainSkillListings();
    return listings.map((listing) => ({
      id: `chain-${listing.publicKey}`,
      skill_id: listing.publicKey,
      author_pubkey: listing.data.author,
      name: listing.data.name,
      description: listing.data.description,
      tags: [],
      current_version: 1,
      ipfs_cid: null,
      on_chain_address: listing.publicKey,
      skill_uri: listing.data.skillUri || null,
      chain_context: configuredSolanaChainContext,
      total_installs: 0,
      total_downloads: Number(listing.data.totalDownloads),
      price_lamports: Number(listing.data.priceLamports),
      total_revenue: Number(listing.data.totalRevenue),
      created_at: new Date(Number(listing.data.createdAt) * 1000).toISOString(),
      updated_at: new Date(Number(listing.data.updatedAt) * 1000).toISOString(),
      source: "chain" as const,
    }));
  } catch (error) {
    console.error("Failed to fetch on-chain listings:", error);
    return [];
  }
}

function mergeSkills(
  pgSkills: RepoMergedSkillRow[],
  chainSkills: ChainSkillRow[]
): MergedSkillRow[] {
  const merged: MergedSkillRow[] = [...pgSkills];

  for (const chain of chainSkills) {
    // Only merge into a PG skill if the on_chain_address already recorded there matches.
    // Two separate on-chain listings (different pubkeys) are always kept as separate cards.
    const existing = merged.find(
      (s) =>
        s.source === "repo" && s.on_chain_address === chain.on_chain_address
    );
    if (existing) {
      existing.price_lamports = chain.price_lamports;
      existing.total_downloads = chain.total_downloads;
      existing.total_revenue = chain.total_revenue;
      existing.skill_uri = chain.skill_uri;
    } else {
      merged.push(chain);
    }
  }

  return merged;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q");
    const sort = searchParams.get("sort") || "newest";
    const author = searchParams.get("author");
    const buyer = searchParams.get("buyer");
    const tags = searchParams.get("tags");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

    let pgSkills: RepoSkillRow[] = [];
    try {
      if (q) {
        pgSkills = await sql()<RepoSkillRow>`
          SELECT *
          FROM skills
          WHERE to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${q})
          ${author ? sql()`AND author_pubkey = ${author}` : sql()``}
          ${
            tags
              ? sql()`AND tags && ${tags.split(",").filter(Boolean)}::text[]`
              : sql()``
          }
        `;
      } else {
        pgSkills = await sql()<RepoSkillRow>`
          SELECT *
          FROM skills
          WHERE 1=1
          ${author ? sql()`AND author_pubkey = ${author}` : sql()``}
          ${
            tags
              ? sql()`AND tags && ${tags.split(",").filter(Boolean)}::text[]`
              : sql()``
          }
        `;
      }
    } catch {
      pgSkills = [];
    }

    const normalizedPgSkills: RepoMergedSkillRow[] = pgSkills.map((skill) => ({
      ...skill,
      chain_context: normalizePersistedChainContext(skill.chain_context),
      source: "repo",
    }));

    const chainSkills = tags ? [] : await fetchOnChainListings();

    let allSkills = mergeSkills(normalizedPgSkills, chainSkills);

    if (author) {
      allSkills = allSkills.filter((s) => s.author_pubkey === author);
    }
    if (q) {
      const lower = q.toLowerCase();
      allSkills = allSkills.filter(
        (s) =>
          s.source === "repo" ||
          s.name.toLowerCase().includes(lower) ||
          (s.description || "").toLowerCase().includes(lower)
      );
    }

    const authorPubkeys = [...new Set(allSkills.map((s) => s.author_pubkey))];
    const trustMap =
      authorPubkeys.length > 0
        ? await resolveMultipleAuthorTrust(authorPubkeys)
        : new Map();
    let identityMap = new Map();
    if (authorPubkeys.length > 0) {
      try {
        identityMap = await resolveManyAgentIdentitiesByWallet(authorPubkeys, {
          hasAgentProfileByWallet: new Map(
            authorPubkeys.map((authorPubkey) => [
              authorPubkey,
              trustMap.get(authorPubkey)?.isRegistered ?? false,
            ])
          ),
        });
      } catch (error) {
        console.error(
          "Failed to resolve author identities for /api/skills:",
          error
        );
      }
    }

    const enriched = allSkills.map((skill) => {
      const authorTrust = trustMap.get(skill.author_pubkey) || null;
      const authorIdentity = identityMap.get(skill.author_pubkey) || null;

      return {
        ...skill,
        author_trust: authorTrust,
        author_trust_summary: authorTrust
          ? buildAgentTrustSummary({
              walletPubkey: skill.author_pubkey,
              trust: authorTrust,
              identity: authorIdentity,
            })
          : null,
        author_identity: authorIdentity,
      };
    });

    if (sort === "trusted") {
      enriched.sort(
        (a, b) =>
          (b.author_trust?.reputationScore ?? 0) -
          (a.author_trust?.reputationScore ?? 0)
      );
    } else if (sort === "installs") {
      enriched.sort(
        (a, b) =>
          b.total_installs +
          (b.total_downloads ?? 0) -
          (a.total_installs + (a.total_downloads ?? 0))
      );
    } else if (sort === "name") {
      enriched.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      enriched.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    const total = enriched.length;
    const offset = (page - 1) * PAGE_SIZE;
    const paged = enriched.slice(offset, offset + PAGE_SIZE);
    const buyerAddress = buyer && isAddress(buyer) ? address(buyer) : null;
    const preflightContext = await createPurchasePreflightContext({
      rpc,
      buyer: buyerAddress,
      authors: paged
        .filter((skill) => (skill.price_lamports ?? 0) > 0)
        .map((skill) => skill.author_pubkey)
        .filter(isAddress)
        .map((pubkey) => address(pubkey)),
    });
    const pagedWithPricing = paged.map((skill) => {
      const creatorPriceLamports = BigInt(skill.price_lamports ?? 0);
      const preflight = serializePurchasePreflight(
        assessPurchasePreflight({
          context: preflightContext,
          priceLamports: creatorPriceLamports,
          author: isAddress(skill.author_pubkey)
            ? address(skill.author_pubkey)
            : null,
        })
      );
      return {
        ...skill,
        ...preflight,
      };
    });

    return NextResponse.json(
      {
        skills: pagedWithPricing,
        pagination: {
          page,
          pageSize: PAGE_SIZE,
          total,
          totalPages: Math.ceil(total / PAGE_SIZE),
        },
      },
      {
        headers: {
          "Cache-Control": buyer
            ? PRIVATE_NO_STORE_CACHE_CONTROL
            : buildPublicCacheControl(
                PUBLIC_ROUTE_CACHE_SECONDS.skillsList,
                PUBLIC_ROUTE_STALE_SECONDS.skillsList
              ),
        },
      }
    );
  } catch (error: unknown) {
    console.error("GET /api/skills error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auth, skill_id, name, description, tags, content, contact } =
      body as {
        auth: AuthPayload;
        skill_id: string;
        name: string;
        description?: string;
        tags?: string[];
        content: string;
        contact?: string;
        chain_context?: string;
      };

    if (!auth || !skill_id || !name || !content) {
      return NextResponse.json(
        { error: "Missing required fields: auth, skill_id, name, content" },
        { status: 400 }
      );
    }

    const verification = verifyWalletSignature(auth);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Invalid signature" },
        { status: 401 }
      );
    }

    const authorPubkey = verification.pubkey!;
    const normalizedName = normalizeSkillName(name);
    const normalizedDescription = description
      ? normalizeSkillDescription(description)
      : "";
    const normalizedContact = contact ? normalizeSkillContact(contact) : "";
    const normalizedChainContext = body.chain_context
      ? normalizeInputChainContext(body.chain_context)
      : configuredSolanaChainContext;

    if (!normalizedName) {
      return NextResponse.json(
        { error: "Skill name is required" },
        { status: 400 }
      );
    }

    if (body.chain_context && !normalizedChainContext) {
      return NextResponse.json(
        {
          error:
            "Invalid chain_context. Use a supported CAIP-2 value or known alias.",
        },
        { status: 400 }
      );
    }

    let trust;
    try {
      trust = await verifyAuthorTrust(authorPubkey);
    } catch {
      return NextResponse.json(
        { error: "Unable to verify on-chain registration. Please try again." },
        { status: 503 }
      );
    }

    if (!trust.isRegistered) {
      return NextResponse.json(
        {
          error:
            "You must register an on-chain AgentProfile before publishing. Go to your Profile tab to register.",
        },
        { status: 403 }
      );
    }

    await initializeDatabase();

    const pinResult = await pinSkillContent(content, skill_id, 1);
    try {
      await upsertLocalAgentIdentity({
        walletPubkey: authorPubkey,
        chainContext: normalizedChainContext,
        hasAgentProfile: trust.isRegistered,
      });
    } catch (error) {
      console.error(
        "Failed to upsert local agent identity during skill publish:",
        error
      );
    }

    const [skill] = await sql()<RepoSkillRow>`
      INSERT INTO skills (skill_id, author_pubkey, name, description, tags, current_version, ipfs_cid, contact, chain_context)
      VALUES (
        ${skill_id},
        ${authorPubkey},
        ${normalizedName},
        ${normalizedDescription || null},
        ${tags || []}::text[],
        1,
        ${pinResult.success ? pinResult.cid : null},
        ${normalizedContact || null},
        ${normalizedChainContext}
      )
      RETURNING *
    `;

    await sql()`
      INSERT INTO skill_versions (skill_id, version, content, ipfs_cid, changelog)
      VALUES (
        ${skill.id}::uuid,
        1,
        ${content},
        ${pinResult.success ? pinResult.cid : null},
        'Initial release'
      )
    `;

    return NextResponse.json(
      {
        ...skill,
        ipfs: pinResult,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/skills error:", error);
    const message = getErrorMessage(error);
    if (message.includes("unique")) {
      return NextResponse.json(
        { error: "A skill with this ID already exists for your account" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
