import { buildDownloadRawMessage, buildSignMessage } from "@agentvouch/protocol";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  createDownloadAuthPayload,
  createRepoAuthPayload,
} from "../src/lib/signer.js";

describe("signer helpers", () => {
  it("builds the canonical repo auth payload", () => {
    const keypair = Keypair.generate();
    const timestamp = 1_709_234_567_890;
    const payload = createRepoAuthPayload(keypair, "publish-skill", timestamp);

    expect(payload.pubkey).toBe(keypair.publicKey.toBase58());
    expect(payload.message).toBe(buildSignMessage("publish-skill", timestamp));
    expect(payload.timestamp).toBe(timestamp);
    expect(payload.signature.length).toBeGreaterThan(10);
  });

  it("builds the canonical paid download payload", () => {
    const keypair = Keypair.generate();
    const timestamp = 1_709_234_567_891;
    const payload = createDownloadAuthPayload(
      keypair,
      "595f5534-07ae-4839-a45a-b6858ab731fe",
      "37Mm4DzMockListing",
      timestamp
    );

    expect(payload.pubkey).toBe(keypair.publicKey.toBase58());
    expect(payload.message).toBe(
      buildDownloadRawMessage(
        "595f5534-07ae-4839-a45a-b6858ab731fe",
        "37Mm4DzMockListing",
        timestamp
      )
    );
    expect(payload.timestamp).toBe(timestamp);
    expect(payload.signature.length).toBeGreaterThan(10);
  });
});
