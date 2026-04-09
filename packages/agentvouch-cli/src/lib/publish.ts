import path from "node:path";
import { createRepoAuthPayload, loadKeypair } from "./signer.js";
import { readUtf8File } from "./fs.js";
import { AgentVouchApiClient } from "./http.js";
import { AgentVouchSolanaClient } from "./solana.js";

export interface PublishSkillInput {
  file: string;
  skillId: string;
  name: string;
  description: string;
  contact?: string;
  tags: string[];
  priceLamports: number;
  baseUrl: string;
  rpcUrl: string;
  keypairPath: string;
  dryRun?: boolean;
}

export interface AddSkillVersionInput {
  id: string;
  file: string;
  changelog?: string;
  baseUrl: string;
  keypairPath: string;
}

export async function publishSkill(input: PublishSkillInput) {
  const content = await readUtf8File(path.resolve(input.file));
  const keypair = loadKeypair(input.keypairPath);
  const repoAuth = createRepoAuthPayload(keypair, "publish-skill");
  const solana = new AgentVouchSolanaClient(keypair, input.rpcUrl);
  const listingAddress = solana
    .getSkillListingAddress(input.skillId)
    .toBase58();

  if (input.dryRun) {
    return {
      ok: true,
      mode: "dry-run",
      repoRequest: {
        skill_id: input.skillId,
        name: input.name,
        description: input.description,
        tags: input.tags,
        contact: input.contact,
      },
      onChainListing: {
        address: listingAddress,
        priceLamports: input.priceLamports,
      },
    };
  }

  const api = new AgentVouchApiClient(input.baseUrl);
  const repoSkill = await api.publishSkill({
    auth: repoAuth,
    skill_id: input.skillId,
    name: input.name,
    description: input.description,
    tags: input.tags,
    contact: input.contact,
    content,
  });

  const skillUri = `${input.baseUrl}/api/skills/${repoSkill.id}/raw`;
  const chainListing = await solana.createSkillListing({
    skillId: input.skillId,
    skillUri,
    name: input.name,
    description: input.description,
    priceLamports: input.priceLamports,
  });

  const linkAuth = createRepoAuthPayload(keypair, "publish-skill");
  await api.linkSkillListing(repoSkill.id, {
    auth: linkAuth,
    on_chain_address: listingAddress,
  });

  return {
    ok: true,
    repoSkillId: repoSkill.id,
    skillId: input.skillId,
    skillUri,
    listingAddress,
    repoIpfsCid: repoSkill.ipfs_cid,
    createListingTx: chainListing.tx,
    listingAlreadyExisted: chainListing.alreadyExists,
  };
}

export async function addSkillVersion(input: AddSkillVersionInput) {
  const api = new AgentVouchApiClient(input.baseUrl);
  const keypair = loadKeypair(input.keypairPath);
  const auth = createRepoAuthPayload(keypair, "publish-skill");
  const content = await readUtf8File(path.resolve(input.file));
  const result = await api.addSkillVersion(input.id, {
    auth,
    content,
    changelog: input.changelog,
  });

  return {
    ok: true,
    skillId: input.id,
    version: result.version,
  };
}
