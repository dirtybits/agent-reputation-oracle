import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveAuthorTrust } from "@/lib/trust";
import { getOnChainPrice } from "@/lib/onchain";
import { verifyWalletSignature, type AuthPayload } from "@/lib/auth";
import { resolveAgentIdentityByWallet } from "@/lib/agentIdentity";
import { hasOnChainPurchase } from "@/lib/x402";
import {
  getConfiguredSolanaChainContext,
  normalizePersistedChainContext,
} from "@/lib/chains";
import {
  assessPurchasePreflight,
  createPurchasePreflightContext,
  serializePurchasePreflight,
} from "@/lib/purchasePreflight";
import { getErrorMessage } from "@/lib/errors";
import { address, createSolanaRpc, isAddress } from "@solana/kit";
import type { Base64EncodedBytes } from "@solana/rpc-types";
import {
  getSkillListingDecoder,
  SKILL_LISTING_DISCRIMINATOR,
} from "../../../../generated/reputation-oracle/src/generated";
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from "../../../../generated/reputation-oracle/src/generated/programs";

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
  tags: string[];
  current_version: number;
  ipfs_cid: string | null;
  on_chain_address: string | null;
  chain_context: string | null;
  total_installs: number;
  total_downloads?: number;
  price_lamports?: number;
  contact?: string | null;
  created_at: string;
  updated_at: string;
};

type SkillVersionRow = {
  id: string;
  version: number;
  content: string;
  ipfs_cid: string | null;
  changelog: string | null;
  created_at: string;
};

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
  for (const a of accounts) {
    if (a.pubkey !== pubkey) continue;
    const data = decoder.decode(
      new Uint8Array(Buffer.from(a.account.data[0], "base64"))
    );
    return { pubkey: a.pubkey, data };
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const includeTrust = searchParams.get("include") !== "none";
    const buyer = searchParams.get("buyer");
    const buyerAddress = buyer && isAddress(buyer) ? address(buyer) : null;

    if (id.startsWith(CHAIN_PREFIX)) {
      const onChainAddr = id.slice(CHAIN_PREFIX.length);
      const listing = await fetchChainSkill(onChainAddr);
      if (!listing) {
        return NextResponse.json({ error: "Skill not found" }, { status: 404 });
      }
      const preflightContext = await createPurchasePreflightContext({
        rpc,
        buyer: buyerAddress,
        authors: isAddress(String(listing.data.author))
          ? [address(String(listing.data.author))]
          : [],
      });
      const preflight = serializePurchasePreflight(
        assessPurchasePreflight({
          context: preflightContext,
          priceLamports: BigInt(listing.data.priceLamports),
          author: isAddress(String(listing.data.author))
            ? address(String(listing.data.author))
            : null,
        })
      );

      let author_trust = null;
      if (includeTrust) {
        author_trust = await resolveAuthorTrust(listing.data.author as string);
      }
      let author_identity = null;
      try {
        author_identity = await resolveAgentIdentityByWallet(
          listing.data.author as string,
          {
            hasAgentProfile: author_trust?.isRegistered ?? false,
          }
        );
      } catch (error) {
        console.error(
          "Failed to resolve author identity for chain skill:",
          error
        );
      }

      let content: string | null = null;
      if (listing.data.skillUri) {
        try {
          const res = await fetch(listing.data.skillUri);
          if (res.ok) content = await res.text();
        } catch {
          /* best effort */
        }
      }
      const buyerHasPurchased =
        buyerAddress && BigInt(listing.data.priceLamports) > 0n
          ? await hasOnChainPurchase(
              String(buyerAddress),
              listing.pubkey
            ).catch(() => false)
          : false;

      return NextResponse.json({
        id: `chain-${listing.pubkey}`,
        skill_id: listing.pubkey,
        author_pubkey: listing.data.author,
        name: listing.data.name,
        description: listing.data.description,
        tags: [],
        current_version: 1,
        ipfs_cid: null,
        on_chain_address: listing.pubkey,
        chain_context: configuredSolanaChainContext,
        total_installs: 0,
        total_downloads: Number(listing.data.totalDownloads),
        price_lamports: Number(listing.data.priceLamports),
        contact: null,
        created_at: new Date(
          Number(listing.data.createdAt) * 1000
        ).toISOString(),
        updated_at: new Date(
          Number(listing.data.updatedAt) * 1000
        ).toISOString(),
        source: "chain",
        skill_uri: listing.data.skillUri,
        content,
        versions: [],
        author_trust,
        author_identity,
        buyerHasPurchased,
        content_verification: null,
        ...preflight,
      });
    }

    const rows = await sql()<SkillRow>`
      SELECT * FROM skills WHERE id = ${id}::uuid
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const skill = rows[0];
    skill.chain_context = normalizePersistedChainContext(skill.chain_context);

    if (skill.on_chain_address) {
      const listing = await getOnChainPrice(skill.on_chain_address);
      if (listing) {
        skill.price_lamports = listing.price;
      }
    }

    const versions = await sql()<SkillVersionRow>`
      SELECT id, version, content, ipfs_cid, changelog, created_at
      FROM skill_versions
      WHERE skill_id = ${id}::uuid
      ORDER BY version DESC
    `;

    const latestContent = versions[0]?.content ?? null;

    let author_trust = null;
    if (includeTrust) {
      author_trust = await resolveAuthorTrust(skill.author_pubkey);
    }
    let author_identity = null;
    try {
      author_identity = await resolveAgentIdentityByWallet(
        skill.author_pubkey,
        {
          hasAgentProfile: author_trust?.isRegistered ?? false,
        }
      );
    } catch (error) {
      console.error("Failed to resolve author identity for repo skill:", error);
    }

    const latestVersion = versions[0];
    const allPinned = versions.every((version) => !!version.ipfs_cid);
    const currentCidMatch = latestVersion?.ipfs_cid === skill.ipfs_cid;
    const content_verification = {
      has_ipfs: !!skill.ipfs_cid,
      all_versions_pinned: allPinned,
      current_cid_consistent: currentCidMatch,
      status: !skill.ipfs_cid
        ? "unverified"
        : allPinned && currentCidMatch
        ? "verified"
        : "drift_detected",
    };

    const versionsWithoutContent = versions.map((version) => {
      const rest = { ...version };
      delete (rest as { content?: unknown }).content;
      return rest;
    });
    const preflightContext = await createPurchasePreflightContext({
      rpc,
      buyer: buyerAddress,
      authors: isAddress(skill.author_pubkey)
        ? [address(skill.author_pubkey)]
        : [],
    });
    const preflight = serializePurchasePreflight(
      assessPurchasePreflight({
        context: preflightContext,
        priceLamports: BigInt(skill.price_lamports ?? 0),
        author: isAddress(skill.author_pubkey)
          ? address(skill.author_pubkey)
          : null,
      })
    );
    const buyerHasPurchased =
      buyerAddress && skill.on_chain_address && (skill.price_lamports ?? 0) > 0
        ? await hasOnChainPurchase(
            String(buyerAddress),
            String(skill.on_chain_address)
          ).catch(() => false)
        : false;

    return NextResponse.json({
      ...skill,
      content: latestContent,
      versions: versionsWithoutContent,
      author_trust,
      author_identity,
      buyerHasPurchased,
      content_verification,
      ...preflight,
    });
  } catch (error: unknown) {
    console.error("GET /api/skills/[id] error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { auth, on_chain_address } = body as {
      auth: AuthPayload;
      on_chain_address: string;
    };

    if (!auth || !on_chain_address) {
      return NextResponse.json(
        { error: "Missing required fields: auth, on_chain_address" },
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

    const rows = await sql()<Pick<SkillRow, "id" | "author_pubkey">>`
      SELECT id, author_pubkey FROM skills WHERE id = ${id}::uuid
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    if (rows[0].author_pubkey !== verification.pubkey) {
      return NextResponse.json(
        { error: "Not the skill author" },
        { status: 403 }
      );
    }

    const [updated] = await sql()<SkillRow>`
      UPDATE skills
      SET on_chain_address = ${on_chain_address}, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    return NextResponse.json({
      ...updated,
      chain_context: normalizePersistedChainContext(updated.chain_context),
    });
  } catch (error: unknown) {
    console.error("PATCH /api/skills/[id] error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
