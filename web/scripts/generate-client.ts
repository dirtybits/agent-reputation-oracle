import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const idlPath = path.join(__dirname, "../reputation_oracle.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

const codama = createFromRoot(rootNodeFromAnchor(idl));

const outputPath = path.join(__dirname, "../generated/reputation-oracle");

if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { recursive: true });
}

async function main() {
  await Promise.resolve(codama.accept(renderVisitor(outputPath)));

  const rootIndexPath = path.join(outputPath, "src/generated/index.ts");
  const rootIndex = fs.readFileSync(rootIndexPath, "utf-8");
  const instructionsBarrel = [
    'export * from "./instructions/claimVoucherRevenue";',
    'export * from "./instructions/createSkillListing";',
    'export * from "./instructions/initializeConfig";',
    'export * from "./instructions/openAuthorDispute";',
    'export * from "./instructions/openDispute";',
    'export * from "./instructions/purchaseSkill";',
    'export * from "./instructions/registerAgent";',
    'export * from "./instructions/resolveAuthorDispute";',
    'export * from "./instructions/resolveDispute";',
    'export * from "./instructions/revokeVouch";',
    'export * from "./instructions/updateSkillListing";',
    "export {",
    "  getVouchInstruction,",
    "  getVouchInstructionAsync,",
    "  getVouchInstructionDataCodec,",
    "  getVouchInstructionDataDecoder,",
    "  getVouchInstructionDataEncoder,",
    "  parseVouchInstruction,",
    "  VOUCH_DISCRIMINATOR as VOUCH_INSTRUCTION_DISCRIMINATOR,",
    "  getVouchDiscriminatorBytes as getVouchInstructionDiscriminatorBytes,",
    "  type ParsedVouchInstruction,",
    "  type VouchAsyncInput,",
    "  type VouchInput,",
    "  type VouchInstruction,",
    "  type VouchInstructionData,",
    "  type VouchInstructionDataArgs,",
    '} from "./instructions/vouch";',
  ].join("\n");

  fs.writeFileSync(
    rootIndexPath,
    rootIndex.replace('export * from "./instructions";', instructionsBarrel)
  );

  console.log("Client generated at:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
