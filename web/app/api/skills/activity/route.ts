import { NextResponse } from "next/server";
import { initializeDatabase, sql } from "@/lib/db";
import {
  buildPublicCacheControl,
  PUBLIC_ROUTE_CACHE_SECONDS,
  PUBLIC_ROUTE_STALE_SECONDS,
} from "@/lib/cachePolicy";
import { getErrorMessage } from "@/lib/errors";

type RepoListingActivityRow = {
  id: string;
  name: string;
  author_pubkey: string;
  on_chain_address: string | null;
  price_usdc_micros: string | null;
  currency_mint: string | null;
};

type UsdcPurchaseActivityRow = {
  payment_tx_signature: string;
  buyer_pubkey: string;
  currency_mint: string;
  amount_micros: string;
  verified_at: string;
  skill_db_id: string;
  skill_name: string;
  author_pubkey: string;
  on_chain_address: string | null;
  price_usdc_micros: string | null;
};

export async function GET() {
  try {
    await initializeDatabase();

    const [repoListings, usdcPurchases] = await Promise.all([
      sql()<RepoListingActivityRow>`
        SELECT
          id,
          name,
          author_pubkey,
          on_chain_address,
          price_usdc_micros,
          currency_mint
        FROM skills
        WHERE on_chain_address IS NOT NULL
      `,
      sql()<UsdcPurchaseActivityRow>`
        SELECT
          r.payment_tx_signature,
          r.buyer_pubkey,
          r.currency_mint,
          r.amount_micros::text AS amount_micros,
          r.verified_at::text AS verified_at,
          s.id AS skill_db_id,
          s.name AS skill_name,
          s.author_pubkey,
          s.on_chain_address,
          s.price_usdc_micros
        FROM usdc_purchase_receipts r
        INNER JOIN skills s
          ON s.id = r.skill_db_id
        ORDER BY r.verified_at DESC
        LIMIT 20
      `,
    ]);

    return NextResponse.json(
      {
        repoListings: repoListings.map((skill) => ({
          ...skill,
          payment_flow: skill.price_usdc_micros ? "x402-usdc" : "free",
        })),
        usdcPurchases,
      },
      {
        headers: {
          "Cache-Control": buildPublicCacheControl(
            PUBLIC_ROUTE_CACHE_SECONDS.skillsList,
            PUBLIC_ROUTE_STALE_SECONDS.skillsList
          ),
        },
      }
    );
  } catch (error: unknown) {
    console.error("GET /api/skills/activity error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
