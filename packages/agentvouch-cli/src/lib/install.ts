import path from "node:path";
import { CliError } from "./errors.js";
import { assertWritableOutputPath, writeUtf8File } from "./fs.js";
import { type SkillRecord, AgentVouchApiClient } from "./http.js";
import {
  buildInstalledSkillMetadata,
  getInstallMetadataPath,
  writeInstalledSkillMetadata,
} from "./metadata.js";
import { createDownloadAuthPayload, loadKeypair } from "./signer.js";
import { AgentVouchSolanaClient } from "./solana.js";

export interface InstallSkillInput {
  id: string;
  out: string;
  force?: boolean;
  dryRun?: boolean;
  baseUrl: string;
  rpcUrl: string;
  keypairPath?: string;
}

async function resolveChainSkillContent(
  skill: SkillRecord,
  api: AgentVouchApiClient
): Promise<string> {
  if ((skill.price_lamports ?? 0) > 0) {
    throw new CliError(
      `Skill ${skill.id} is chain-only and paid. Use the repo-backed skill id for signed raw downloads.`
    );
  }

  if (skill.content) {
    return skill.content;
  }

  if (
    skill.skill_uri?.startsWith("http://") ||
    skill.skill_uri?.startsWith("https://")
  ) {
    return api.fetchRemoteText(skill.skill_uri);
  }

  throw new CliError(
    `Skill ${skill.id} does not expose downloadable content through the API.`
  );
}

export async function installSkill(input: InstallSkillInput) {
  const api = new AgentVouchApiClient(input.baseUrl);
  const skill = await api.getSkill(input.id);
  const outputPath = path.resolve(input.out);
  const metadataPath = getInstallMetadataPath(outputPath);

  if (!input.dryRun) {
    await assertWritableOutputPath(outputPath, input.force);
  }

  const isChainOnly =
    skill.source === "chain" || input.id.startsWith("chain-") || !skill.id;

  if (isChainOnly) {
    const content = await resolveChainSkillContent(skill, api);
    if (!input.dryRun) {
      await writeUtf8File(outputPath, content);
      await writeInstalledSkillMetadata(
        outputPath,
        buildInstalledSkillMetadata(input.id, skill)
      );
    }
    return {
      ok: true,
      mode: "chain-direct",
      skillId: input.id,
      outputPath,
      metadataPath,
      priceLamports: skill.price_lamports ?? 0,
      dryRun: !!input.dryRun,
    };
  }

  const initialDownload = await api.downloadRaw(input.id);
  if (initialDownload.ok && initialDownload.content !== undefined) {
    if (!input.dryRun) {
      await writeUtf8File(outputPath, initialDownload.content);
      await writeInstalledSkillMetadata(
        outputPath,
        buildInstalledSkillMetadata(input.id, skill)
      );
    }
    return {
      ok: true,
      mode: "free-raw",
      skillId: input.id,
      outputPath,
      metadataPath,
      priceLamports: skill.price_lamports ?? 0,
      dryRun: !!input.dryRun,
    };
  }

  if (initialDownload.status !== 402 || !initialDownload.requirement) {
    throw new CliError(
      `Failed to download skill ${input.id}: ${
        initialDownload.error || "unexpected response"
      }`
    );
  }

  if (input.dryRun) {
    return {
      ok: true,
      mode: "paid-raw-dry-run",
      skillId: input.id,
      outputPath,
      metadataPath,
      priceLamports: initialDownload.requirement.amount,
      listingAddress: initialDownload.requirement.skillListingAddress,
      requirement: initialDownload.requirement,
      dryRun: true,
    };
  }

  if (!input.keypairPath) {
    throw new CliError(
      "Paid installs require --keypair so the CLI can purchase on-chain and sign the canonical X-AgentVouch-Auth payload."
    );
  }

  if (!skill.on_chain_address) {
    throw new CliError(
      `Skill ${input.id} returned a payment requirement but has no linked on-chain listing.`
    );
  }

  const keypair = loadKeypair(input.keypairPath);
  const solana = new AgentVouchSolanaClient(keypair, input.rpcUrl);
  const purchase = await solana.purchaseSkill(
    initialDownload.requirement.skillListingAddress,
    skill.author_pubkey
  );
  const auth = createDownloadAuthPayload(
    keypair,
    input.id,
    initialDownload.requirement.skillListingAddress
  );
  const signedDownload = await api.downloadRaw(input.id, auth);

  if (!signedDownload.ok || signedDownload.content === undefined) {
    throw new CliError(
      `Purchase completed but signed raw download failed: ${
        signedDownload.error || "unexpected response"
      }`
    );
  }

  await writeUtf8File(outputPath, signedDownload.content);
  await writeInstalledSkillMetadata(
    outputPath,
    buildInstalledSkillMetadata(input.id, skill)
  );

  return {
    ok: true,
    mode: "paid-raw",
    skillId: input.id,
    outputPath,
    metadataPath,
    priceLamports: initialDownload.requirement.amount,
    listingAddress: initialDownload.requirement.skillListingAddress,
    purchaseTx: purchase.tx,
    alreadyPurchased: purchase.alreadyPurchased,
    dryRun: false,
  };
}
