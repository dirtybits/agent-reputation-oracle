import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSignMessage } from "@agentvouch/protocol";
import { Keypair } from "@solana/web3.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentVouchApiClient } from "../src/lib/http.js";
import { addSkillVersion, publishSkill } from "../src/lib/publish.js";
import { AgentVouchSolanaClient } from "../src/lib/solana.js";

async function createFixtureFiles() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "agentvouch-cli-"));
  const keypair = Keypair.generate();
  const keypairPath = path.join(tempDir, "id.json");
  const skillFile = path.join(tempDir, "SKILL.md");
  await writeFile(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
  await writeFile(skillFile, "# skill content\n");
  return { keypairPath, skillFile };
}

describe("publish flows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("assembles repo publish and listing link requests", async () => {
    const { keypairPath, skillFile } = await createFixtureFiles();
    let publishBody: Record<string, unknown> | null = null;
    let linkBody: Record<string, unknown> | null = null;

    vi.spyOn(AgentVouchApiClient.prototype, "publishSkill").mockImplementation(
      async (body) => {
        publishBody = body;
        return {
          id: "595f5534-07ae-4839-a45a-b6858ab731fe",
          skill_id: "calendar-agent",
          ipfs_cid: "bafy-test",
        };
      }
    );
    vi.spyOn(AgentVouchApiClient.prototype, "linkSkillListing").mockImplementation(
      async (_id, body) => {
        linkBody = body;
        return {
          id: "595f5534-07ae-4839-a45a-b6858ab731fe",
          skill_id: "calendar-agent",
          author_pubkey: Keypair.generate().publicKey.toBase58(),
          name: "Calendar Agent",
          description: "Books meetings",
          on_chain_address: String(body.on_chain_address),
          total_installs: 0,
        };
      }
    );
    vi.spyOn(
      AgentVouchSolanaClient.prototype,
      "createSkillListing"
    ).mockResolvedValue({
      tx: "mock-create-tx",
      alreadyExists: false,
      skillListing: "mock-listing",
    });

    const result = await publishSkill({
      file: skillFile,
      skillId: "calendar-agent",
      name: "Calendar Agent",
      description: "Books meetings",
      tags: ["calendar", "ops"],
      priceLamports: 1_000_000,
      baseUrl: "https://agentvouch.xyz",
      rpcUrl: "https://api.devnet.solana.com",
      keypairPath,
    });

    expect(result.repoSkillId).toBe("595f5534-07ae-4839-a45a-b6858ab731fe");
    expect(String(publishBody?.skill_id)).toBe("calendar-agent");
    expect(String(publishBody?.content)).toContain("# skill content");
    expect(String((publishBody?.auth as { message: string }).message)).toContain(
      buildSignMessage("publish-skill", (publishBody?.auth as { timestamp: number }).timestamp)
    );
    expect(String(linkBody?.on_chain_address)).toBe(result.listingAddress);
    expect(String((linkBody?.auth as { message: string }).message)).toContain(
      buildSignMessage("publish-skill", (linkBody?.auth as { timestamp: number }).timestamp)
    );
  });

  it("assembles version update requests", async () => {
    const { keypairPath, skillFile } = await createFixtureFiles();
    let versionBody: Record<string, unknown> | null = null;

    vi.spyOn(AgentVouchApiClient.prototype, "addSkillVersion").mockImplementation(
      async (_id, body) => {
        versionBody = body;
        return { version: 2 };
      }
    );

    const result = await addSkillVersion({
      id: "595f5534-07ae-4839-a45a-b6858ab731fe",
      file: skillFile,
      changelog: "Fix env names",
      baseUrl: "https://agentvouch.xyz",
      keypairPath,
    });

    expect(result.version).toBe(2);
    expect(String(versionBody?.content)).toContain("# skill content");
    expect(String(versionBody?.changelog)).toBe("Fix env names");
    expect(String((versionBody?.auth as { message: string }).message)).toContain(
      buildSignMessage(
        "publish-skill",
        (versionBody?.auth as { timestamp: number }).timestamp
      )
    );
  });
});
