import { NextResponse } from "next/server";
import { AGENTVOUCH_PROGRAM_ADDRESS } from "../../../../generated/agentvouch/src/generated/programs";
import { getConfiguredSolanaChainContext } from "@/lib/chains";
import { getConfiguredUsdcMint, getFacilitatorUrl } from "@/lib/x402";

const SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112";

export async function GET() {
  const chainContext = getConfiguredSolanaChainContext();
  return NextResponse.json({
    schemes: ["exact"],
    networks: [chainContext],
    chain_contexts: [chainContext],
    assets: [
      {
        address: getConfiguredUsdcMint(),
        symbol: "USDC",
        decimals: 6,
        name: "USD Coin",
        flow: "x402-usdc-direct",
      },
      {
        address: SOL_NATIVE_MINT,
        symbol: "SOL",
        decimals: 9,
        name: "Wrapped SOL",
        flow: "legacy-purchase-skill",
      },
    ],
    program: {
      id: AGENTVOUCH_PROGRAM_ADDRESS,
      instructions: ["purchaseSkill"],
    },
    facilitator: {
      url: getFacilitatorUrl(),
      endpoints: {
        supported: "/supported",
        verify: "/verify",
        settle: "/settle",
      },
    },
    version: "2.3.0-x402-usdc-direct",
  });
}
