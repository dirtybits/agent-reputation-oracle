import { createSolanaRpc } from "@solana/kit";
import type { Base64EncodedBytes } from "@solana/rpc-types";
import {
  getSkillListingDecoder,
  SKILL_LISTING_DISCRIMINATOR,
} from "../generated/reputation-oracle/src/generated";
import { REPUTATION_ORACLE_PROGRAM_ADDRESS } from "../generated/reputation-oracle/src/generated/programs";

const rpc = createSolanaRpc(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
);
const asBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64") as Base64EncodedBytes;

export async function getOnChainPrice(
  onChainAddress: string
): Promise<{ price: number; author: string } | null> {
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
    for (const a of accounts) {
      if (a.pubkey !== onChainAddress) continue;
      const data = decoder.decode(
        new Uint8Array(Buffer.from(a.account.data[0], "base64"))
      );
      return {
        price: Number(data.priceLamports),
        author: data.author as string,
      };
    }
  } catch {
    /* best effort */
  }
  return null;
}
