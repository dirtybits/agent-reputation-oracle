import { NextRequest, NextResponse } from "next/server";
import { resolveAuthorTrust } from "@/lib/trust";
import { resolveAgentIdentityByWallet } from "@/lib/agentIdentity";
import { listAuthorDisputesByAuthor } from "@/lib/authorDisputes";
import { buildAgentTrustSummary } from "@/lib/agentDiscovery";
import { getErrorMessage } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
) {
  try {
    const { pubkey } = await params;
    const trust = await resolveAuthorTrust(pubkey);
    const identity = await resolveAgentIdentityByWallet(pubkey, {
      hasAgentProfile: trust.isRegistered,
    }).catch(() => null);
    const disputes = await listAuthorDisputesByAuthor(pubkey).catch(() => []);
    const trustSummary = buildAgentTrustSummary({
      walletPubkey: pubkey,
      trust,
      identity,
    });

    return NextResponse.json({
      pubkey,
      trust: trustSummary,
      author_trust: trust,
      author_identity: identity,
      author_disputes: disputes,
    });
  } catch (error: unknown) {
    console.error("GET /api/agents/[pubkey]/trust error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
