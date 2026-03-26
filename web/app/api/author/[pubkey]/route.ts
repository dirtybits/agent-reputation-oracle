import { NextRequest, NextResponse } from "next/server";
import { resolveAuthorTrust, verifyAuthorTrust } from "@/lib/trust";
import {
  linkSolanaRegistryIdentity,
  resolveAgentIdentityByWallet,
} from "@/lib/agentIdentity";
import { verifyWalletSignature, type AuthPayload } from "@/lib/auth";
import { discoverSolanaRegistryCandidatesByWallet } from "@/lib/solanaAgentRegistry";
import { listAuthorDisputesByAuthor } from "@/lib/authorDisputes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
) {
  try {
    const { pubkey } = await params;
    const authorTrust = await resolveAuthorTrust(pubkey);
    const authorDisputes = await listAuthorDisputesByAuthor(pubkey);
    let authorIdentity = null;
    try {
      authorIdentity = await resolveAgentIdentityByWallet(pubkey, {
        hasAgentProfile: authorTrust.isRegistered,
      });
    } catch (error) {
      console.error(
        "Failed to resolve author identity for /api/author/[pubkey]:",
        error
      );
    }

    return NextResponse.json({
      pubkey,
      author_trust: authorTrust,
      author_identity: authorIdentity,
      author_disputes: authorDisputes,
    });
  } catch (error: any) {
    console.error("GET /api/author/[pubkey] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
) {
  try {
    const { pubkey } = await params;
    const body = await request.json();
    const {
      auth,
      selected_registry_asset_pubkey,
      registry_address,
      core_asset_pubkey,
      operational_wallet_pubkey,
      display_name,
      chain_context,
      raw_upstream_chain_label,
      raw_upstream_chain_id,
      external_agent_id,
    } = body as {
      auth: AuthPayload;
      selected_registry_asset_pubkey?: string;
      registry_address: string;
      core_asset_pubkey: string;
      operational_wallet_pubkey?: string;
      display_name?: string;
      chain_context?: string;
      raw_upstream_chain_label?: string;
      raw_upstream_chain_id?: string;
      external_agent_id?: string;
    };

    if (!auth) {
      return NextResponse.json(
        { error: "Missing required fields: auth" },
        { status: 400 }
      );
    }

    const verification = verifyWalletSignature(auth);
    if (!verification.valid || !verification.pubkey) {
      return NextResponse.json(
        { error: verification.error || "Invalid signature" },
        { status: 401 }
      );
    }

    if (verification.pubkey !== pubkey) {
      return NextResponse.json(
        { error: "Only the author wallet can link registry identity" },
        { status: 403 }
      );
    }

    const authorTrust = await verifyAuthorTrust(pubkey);
    if (!authorTrust.isRegistered) {
      return NextResponse.json(
        {
          error:
            "You must register an on-chain AgentProfile before linking registry identity.",
        },
        { status: 403 }
      );
    }

    let authorIdentity;
    if (selected_registry_asset_pubkey) {
      const candidates = await discoverSolanaRegistryCandidatesByWallet(
        pubkey,
        { useCache: false }
      );
      const selectedCandidate = candidates.find(
        (candidate) =>
          candidate.coreAssetPubkey === selected_registry_asset_pubkey
      );

      if (!selectedCandidate) {
        return NextResponse.json(
          {
            error: "Selected registry identity was not found for this wallet.",
          },
          { status: 400 }
        );
      }

      authorIdentity = await linkSolanaRegistryIdentity({
        ownerWalletPubkey: pubkey,
        registryAddress: selectedCandidate.registryAddress,
        coreAssetPubkey: selectedCandidate.coreAssetPubkey,
        operationalWalletPubkey: selectedCandidate.operationalWallet,
        displayName: selectedCandidate.displayName,
        chainContext: selectedCandidate.chainContext,
        rawUpstreamChainLabel: selectedCandidate.rawUpstreamChainLabel,
        rawUpstreamChainId: selectedCandidate.rawUpstreamChainId,
        externalAgentId: selectedCandidate.externalAgentId,
        hasAgentProfile: true,
      });
    } else {
      if (!registry_address || !core_asset_pubkey) {
        return NextResponse.json(
          {
            error:
              "Missing required fields: registry_address, core_asset_pubkey",
          },
          { status: 400 }
        );
      }

      authorIdentity = await linkSolanaRegistryIdentity({
        ownerWalletPubkey: pubkey,
        registryAddress: registry_address,
        coreAssetPubkey: core_asset_pubkey,
        operationalWalletPubkey: operational_wallet_pubkey ?? null,
        displayName: display_name ?? null,
        chainContext: chain_context ?? null,
        rawUpstreamChainLabel: raw_upstream_chain_label ?? null,
        rawUpstreamChainId: raw_upstream_chain_id ?? null,
        externalAgentId: external_agent_id ?? null,
        hasAgentProfile: true,
      });
    }

    return NextResponse.json(
      {
        pubkey,
        author_trust: authorTrust,
        author_identity: authorIdentity,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/author/[pubkey] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
