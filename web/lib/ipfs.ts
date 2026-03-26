import { PinataSDK } from "pinata";

let pinataClient: PinataSDK | null = null;

function getPinata(): PinataSDK | null {
  if (!process.env.PINATA_JWT) return null;
  if (!pinataClient) {
    pinataClient = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY || "gateway.pinata.cloud",
    });
  }
  return pinataClient;
}

export interface PinResult {
  cid: string;
  success: boolean;
  error?: string;
}

/**
 * Pins SKILL.md content to IPFS via Pinata.
 * Returns CID on success. If Pinata is unavailable, returns a graceful failure
 * so the skill can still be stored in Postgres without blocking.
 */
export async function pinSkillContent(
  content: string,
  skillId: string,
  version: number
): Promise<PinResult> {
  const pinata = getPinata();
  if (!pinata) {
    return {
      cid: "",
      success: false,
      error: "Pinata not configured (PINATA_JWT missing)",
    };
  }

  try {
    const file = new File([content], `${skillId}-v${version}.md`, {
      type: "text/markdown",
    });

    const upload = await pinata.upload.public
      .file(file)
      .name(`${skillId}-v${version}`)
      .keyvalues({ skillId, version: String(version) });

    return { cid: upload.cid, success: true };
  } catch (err: any) {
    console.error("Pinata pin error:", err);
    return { cid: "", success: false, error: err.message };
  }
}
