import { NextResponse } from "next/server";
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from "../../../../generated/reputation-oracle/src/generated/programs";
import { getConfiguredSolanaChainContext } from "@/lib/chains";

const SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112";

export async function GET() {
  const chainContext = getConfiguredSolanaChainContext();
  return NextResponse.json({
    schemes: ["exact"],
    networks: ["solana"],
    chain_contexts: [chainContext],
    mints: [
      {
        address: SOL_NATIVE_MINT,
        symbol: "SOL",
        decimals: 9,
        name: "Wrapped SOL",
      },
    ],
    program: {
      id: REPUTATION_ORACLE_PROGRAM_ADDRESS,
      instructions: ["purchaseSkill"],
    },
    facilitator_endpoints: {
      verify: "/api/x402/verify",
      settle: "/api/x402/settle",
      supported: "/api/x402/supported",
    },
    version: "2.1.0",
  });
}
