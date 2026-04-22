import { Command } from "commander";
import { convertToTokenAmount } from "@x402/svm";
import cliPackage from "../package.json";
import { resolveBaseUrl, resolveRpcUrl } from "./lib/config.js";
import {
  AgentVouchApiClient,
  type ListAuthorsOptions,
  type ListSkillsOptions,
} from "./lib/http.js";
import {
  formatAgentTrust,
  formatAuthorList,
  formatCreateVouchResult,
  formatRegisterAgentResult,
  formatSkillList,
  formatSkillSummary,
} from "./lib/format.js";
import { installSkill } from "./lib/install.js";
import { runCommand } from "./lib/output.js";
import { addSkillVersion, publishSkill } from "./lib/publish.js";
import { loadKeypair } from "./lib/signer.js";
import { AgentVouchSolanaClient } from "./lib/solana.js";
import { updateSkill } from "./lib/update.js";

export const MIN_SKILL_PRICE_LAMPORTS = 1_000_000;

export function parseLamports(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Expected a non-negative integer lamport amount.");
  }
  if (parsed !== 0 && parsed < MIN_SKILL_PRICE_LAMPORTS) {
    throw new Error(
      `Expected 0 or at least ${MIN_SKILL_PRICE_LAMPORTS} lamports.`
    );
  }
  return parsed;
}

export function parseAmountSol(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected a positive SOL amount.");
  }
  return parsed;
}

export function parseUsdcAmount(value: string): string {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Expected a positive USDC amount with up to 6 decimals.");
  }

  const micros = convertToTokenAmount(normalized, 6);
  if (BigInt(micros) <= 0n) {
    throw new Error("Expected a positive USDC amount.");
  }

  return micros;
}

export function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Expected a positive page number.");
  }
  return parsed;
}

function addBaseUrlOption(command: Command): Command {
  return command.option(
    "--base-url <url>",
    "AgentVouch API base URL",
    resolveBaseUrl()
  );
}

function addRpcUrlOption(command: Command): Command {
  return command.option("--rpc-url <url>", "Solana RPC URL", resolveRpcUrl());
}

function getDeprecatedAliasNotice(
  groupName: "agent" | "author",
  preferredCommand: string
) {
  return groupName === "author"
    ? `\nDeprecated alias: use \`${preferredCommand}\`.\n`
    : "\n";
}

function registerAgentListCommand(
  group: Command,
  groupName: "agent" | "author"
) {
  addBaseUrlOption(
    group
      .command("list")
      .option(
        "--trusted",
        "Only return authors whose recommended action is allow"
      )
      .option("--json", "Print structured JSON output")
      .addHelpText(
        "after",
        `${getDeprecatedAliasNotice(
          groupName,
          "agent list"
        )}Examples:\n  agentvouch ${groupName} list\n  agentvouch ${groupName} list --trusted\n  agentvouch ${groupName} list --json`
      )
      .action(
        async (options: {
          trusted?: boolean;
          baseUrl: string;
          json?: boolean;
        }) => {
          await runCommand(
            options,
            async () =>
              new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).listAuthors(
                {
                  trusted: options.trusted,
                } satisfies ListAuthorsOptions
              ),
            formatAuthorList
          );
        }
      )
  );
}

function registerAgentRegisterCommand(
  group: Command,
  groupName: "agent" | "author"
) {
  addRpcUrlOption(
    group
      .command("register")
      .requiredOption("--keypair <file>", "Solana keypair JSON file")
      .option("--metadata-uri <uri>", "Metadata URI for the agent profile", "")
      .option("--json", "Print structured JSON output")
      .addHelpText(
        "after",
        `${getDeprecatedAliasNotice(
          groupName,
          "agent register"
        )}Examples:\n  agentvouch ${groupName} register --keypair ~/.config/solana/id.json --metadata-uri https://example.com/agent.json`
      )
      .action(
        async (options: {
          keypair: string;
          metadataUri: string;
          rpcUrl: string;
          json?: boolean;
        }) => {
          await runCommand(
            options,
            async () => {
              const keypair = loadKeypair(options.keypair);
              const solana = new AgentVouchSolanaClient(
                keypair,
                resolveRpcUrl(options.rpcUrl)
              );
              return solana.registerAgent(options.metadataUri);
            },
            formatRegisterAgentResult
          );
        }
      )
  );
}

function registerAgentTrustCommand(
  group: Command,
  groupName: "agent" | "author"
) {
  addBaseUrlOption(
    group
      .command("trust")
      .argument("<pubkey>", "Agent wallet pubkey")
      .option("--json", "Print structured JSON output")
      .addHelpText(
        "after",
        `${getDeprecatedAliasNotice(
          groupName,
          "agent trust"
        )}Examples:\n  agentvouch ${groupName} trust asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw\n  agentvouch ${groupName} trust asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw --json`
      )
      .action(
        async (pubkey: string, options: { baseUrl: string; json?: boolean }) => {
          await runCommand(
            options,
            async () =>
              new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).getAgentTrust(
                pubkey
              ),
            formatAgentTrust
          );
        }
      )
  );
}

export function buildProgram(): Command {
  const program = new Command()
  .name("agentvouch")
  .description("Headless CLI for AgentVouch skill install and publish flows.")
  .version(cliPackage.version);

const skill = program
  .command("skill")
  .description("Inspect, list, install, and publish skills.");

addBaseUrlOption(
  skill
    .command("list")
    .option("--q <query>", "Search by keyword")
    .option("--author <pubkey>", "Filter by author pubkey")
    .option("--tags <csv>", "Filter by comma-separated tags")
    .option(
      "--sort <order>",
      "Sort by newest, trusted, installs, or name",
      "newest"
    )
    .option("--page <number>", "Results page number", parsePage, 1)
    .option("--json", "Print structured JSON output")
    .addHelpText(
      "after",
      "\nExamples:\n  agentvouch skill list\n  agentvouch skill list --q calendar --sort trusted\n  agentvouch skill list --author asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw --page 2 --json\n\nTrust contract:\n  author_trust_summary is the normalized machine-readable trust summary.\n  author_trust keeps the raw stake and bond fields."
    )
    .action(
      async (options: {
        q?: string;
        author?: string;
        tags?: string;
        sort: ListSkillsOptions["sort"];
        page: number;
        baseUrl: string;
        json?: boolean;
      }) => {
        await runCommand(
          options,
          async () =>
            new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).listSkills(
              {
                q: options.q,
                author: options.author,
                tags: options.tags,
                sort: options.sort,
                page: options.page,
              }
            ),
          formatSkillList
        );
      }
    )
);

addBaseUrlOption(
  skill
    .command("inspect")
    .argument("<id>", "Repo UUID or chain-<listing> id")
    .option("--json", "Print structured JSON output")
    .addHelpText(
      "after",
      "\nExamples:\n  agentvouch skill inspect 595f5534-07ae-4839-a45a-b6858ab731fe\n  agentvouch skill inspect chain-Eq35iaSKECtZAGMkPVSk18tqFDFe6L3hgEhJsUzkByFd --json\n\nTrust contract:\n  author_trust_summary matches GET /api/agents/{pubkey}/trust -> trust.\n  author_trust includes raw bond and total stake-at-risk fields."
    )
    .action(
      async (id: string, options: { baseUrl: string; json?: boolean }) => {
        await runCommand(
          options,
          async () =>
            new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).getSkill(
              id
            ),
          formatSkillSummary
        );
      }
    )
);

addRpcUrlOption(
  addBaseUrlOption(
    skill
      .command("install")
      .argument("<id>", "Repo UUID or chain-<listing> id")
      .requiredOption(
        "--out <path>",
        "Output path for the downloaded skill file",
        "SKILL.md"
      )
      .option("--keypair <file>", "Solana keypair JSON file for paid installs")
      .option("--force", "Overwrite an existing output file")
      .option(
        "--dry-run",
        "Show the required paid flow without purchasing or writing"
      )
      .option("--json", "Print structured JSON output")
      .addHelpText(
        "after",
        "\nExamples:\n  agentvouch skill install 595f5534-07ae-4839-a45a-b6858ab731fe --out ./SKILL.md\n  agentvouch skill install 595f5534-07ae-4839-a45a-b6858ab731fe --out ./SKILL.md --keypair ~/.config/solana/id.json\n  agentvouch skill install 595f5534-07ae-4839-a45a-b6858ab731fe --out ./SKILL.md --dry-run --json"
      )
      .action(
        async (
          id: string,
          options: {
            out: string;
            keypair?: string;
            force?: boolean;
            dryRun?: boolean;
            baseUrl: string;
            rpcUrl: string;
            json?: boolean;
          }
        ) => {
          await runCommand(
            options,
            async () =>
              installSkill({
                id,
                out: options.out,
                keypairPath: options.keypair,
                force: options.force,
                dryRun: options.dryRun,
                baseUrl: resolveBaseUrl(options.baseUrl),
                rpcUrl: resolveRpcUrl(options.rpcUrl),
              }),
            (result) => [
              `installed ${result.skillId}`,
              `mode: ${result.mode}`,
              `output: ${result.outputPath}`,
              `metadata: ${result.metadataPath}`,
              `price_lamports: ${result.priceLamports}`,
              ...(result.priceUsdcMicros
                ? [`price_usdc_micros: ${result.priceUsdcMicros}`]
                : []),
              ...(result.listingAddress
                ? [`listing: ${result.listingAddress}`]
                : []),
              ...(result.purchaseTx
                ? [`purchase_tx: ${result.purchaseTx}`]
                : []),
              ...(result.dryRun ? ["dry_run: true"] : []),
            ]
          );
        }
      )
  )
);

const skills = program
  .command("skills")
  .description("Update installed repo-backed skills.");

addRpcUrlOption(
  addBaseUrlOption(
    skills
      .command("update")
      .requiredOption("--file <path>", "Path to the local SKILL.md file")
      .option(
        "--id <id>",
        "Repo skill UUID for legacy installs that do not have local metadata"
      )
      .option("--keypair <file>", "Solana keypair JSON file for paid updates")
      .option("--dry-run", "Check for updates without writing or purchasing")
      .option("--json", "Print structured JSON output")
      .addHelpText(
        "after",
        "\nExamples:\n  agentvouch skills update --file ./SKILL.md\n  agentvouch skills update --file ./SKILL.md --keypair ~/.config/solana/id.json\n  agentvouch skills update --file ./SKILL.md --id 595f5534-07ae-4839-a45a-b6858ab731fe --dry-run --json"
      )
      .action(
        async (options: {
          file: string;
          id?: string;
          keypair?: string;
          dryRun?: boolean;
          baseUrl: string;
          rpcUrl: string;
          json?: boolean;
        }) => {
          await runCommand(
            options,
            async () =>
              updateSkill({
                file: options.file,
                id: options.id,
                keypairPath: options.keypair,
                dryRun: options.dryRun,
                baseUrl: resolveBaseUrl(options.baseUrl),
                rpcUrl: resolveRpcUrl(options.rpcUrl),
              }),
            (result) => {
              const headline =
                result.action === "noop" || result.dryRun
                  ? `checked ${result.skillId}`
                  : `updated ${result.skillId}`;
              return [
                headline,
                `action: ${result.action}`,
                `output: ${result.outputPath}`,
                `metadata: ${result.metadataPath}`,
                `installed_version: ${result.installedVersion ?? "unknown"}`,
                `latest_version: ${result.latestVersion}`,
                ...(result.listingAddress
                  ? [`listing: ${result.listingAddress}`]
                  : []),
                `requires_purchase: ${result.requiresPurchase ? "yes" : "no"}`,
                `listing_changed: ${result.listingChanged ? "yes" : "no"}`,
                ...(result.mode ? [`mode: ${result.mode}`] : []),
                ...(result.purchaseTx ? [`purchase_tx: ${result.purchaseTx}`] : []),
                ...(result.dryRun ? ["dry_run: true"] : []),
              ];
            }
          );
        }
      )
  )
);

addRpcUrlOption(
  addBaseUrlOption(
    skill
      .command("publish")
      .requiredOption("--file <path>", "Path to the local SKILL.md file")
      .requiredOption("--skill-id <id>", "Stable on-chain skill id/slug")
      .requiredOption("--name <name>", "Skill display name")
      .requiredOption("--description <text>", "Skill description")
      .requiredOption("--keypair <file>", "Solana keypair JSON file")
      .option("--contact <text>", "Optional author contact info")
      .option("--tags <csv>", "Comma-separated tags", "")
      .option(
        "--price-usdc <amount>",
        "USDC price for the primary x402 flow",
        parseUsdcAmount,
        parseUsdcAmount("1")
      )
      .option(
        "--price-lamports <lamports>",
        "Legacy SOL fallback listing price in lamports",
        parseLamports,
        1_000_000
      )
      .option(
        "--dry-run",
        "Preview the repo and on-chain requests without sending them"
      )
      .option("--json", "Print structured JSON output")
      .addHelpText(
        "after",
        '\nExamples:\n  agentvouch skill publish --file ./SKILL.md --skill-id calendar-agent --name "Calendar Agent" --description "Books and manages calendar tasks" --price-usdc 1 --keypair ~/.config/solana/id.json\n  agentvouch skill publish --file ./SKILL.md --skill-id calendar-agent --name "Calendar Agent" --description "Books and manages calendar tasks" --price-usdc 2.5 --price-lamports 1000000 --keypair ~/.config/solana/id.json --dry-run'
      )
      .action(
        async (options: {
          file: string;
          skillId: string;
          name: string;
          description: string;
          keypair: string;
          contact?: string;
          tags: string;
          priceUsdc: string;
          priceLamports: number;
          dryRun?: boolean;
          baseUrl: string;
          rpcUrl: string;
          json?: boolean;
        }) => {
          await runCommand(
            options,
            async () =>
              publishSkill({
                file: options.file,
                skillId: options.skillId,
                name: options.name,
                description: options.description,
                keypairPath: options.keypair,
                contact: options.contact,
                tags: options.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                priceUsdcMicros: options.priceUsdc,
                priceLamports: options.priceLamports,
                dryRun: options.dryRun,
                baseUrl: resolveBaseUrl(options.baseUrl),
                rpcUrl: resolveRpcUrl(options.rpcUrl),
              }),
            (result) => [
              `published ${result.skillId}`,
              ...(result.mode === "dry-run"
                ? [
                    `repo_skill_id: ${result.repoRequest.skill_id}`,
                    `listing: ${result.onChainListing.address}`,
                    `price_usdc_micros: ${result.repoRequest.price_usdc_micros}`,
                    `price_lamports: ${result.onChainListing.priceLamports}`,
                    "dry_run: true",
                  ]
                : [
                    `repo_id: ${result.repoSkillId}`,
                    `listing: ${result.listingAddress}`,
                    `skill_uri: ${result.skillUri}`,
                    `price_usdc_micros: ${result.priceUsdcMicros}`,
                    `price_ipfs_cid: ${result.repoIpfsCid ?? "none"}`,
                    ...(result.createListingTx
                      ? [`create_listing_tx: ${result.createListingTx}`]
                      : []),
                  ]),
            ]
          );
        }
      )
  )
);

const skillVersion = skill
  .command("version")
  .description("Manage repo skill versions.");

addBaseUrlOption(
  skillVersion
    .command("add")
    .argument("<id>", "Repo skill UUID")
    .requiredOption("--file <path>", "Path to the local SKILL.md file")
    .requiredOption("--keypair <file>", "Solana keypair JSON file")
    .option("--changelog <text>", "Optional changelog entry")
    .option("--json", "Print structured JSON output")
    .addHelpText(
      "after",
      '\nExamples:\n  agentvouch skill version add 595f5534-07ae-4839-a45a-b6858ab731fe --file ./SKILL.md --changelog "Fix env var names" --keypair ~/.config/solana/id.json'
    )
    .action(
      async (
        id: string,
        options: {
          file: string;
          keypair: string;
          changelog?: string;
          baseUrl: string;
          json?: boolean;
        }
      ) => {
        await runCommand(
          options,
          async () =>
            addSkillVersion({
              id,
              file: options.file,
              keypairPath: options.keypair,
              changelog: options.changelog,
              baseUrl: resolveBaseUrl(options.baseUrl),
            }),
          (result) => [
            `added version for ${result.skillId}`,
            `version: ${result.version}`,
          ]
        );
      }
    )
);

const agent = program
  .command("agent")
  .description("Manage agent profile and trust actions.");

registerAgentListCommand(agent, "agent");
registerAgentRegisterCommand(agent, "agent");
registerAgentTrustCommand(agent, "agent");

const author = program
  .command("author")
  .description("Deprecated alias for `agent` commands.");

registerAgentListCommand(author, "author");
registerAgentRegisterCommand(author, "author");
registerAgentTrustCommand(author, "author");

const vouch = program
  .command("vouch")
  .description("Create stake-backed vouches.");

addRpcUrlOption(
  vouch
    .command("create")
    .requiredOption("--author <pubkey>", "Author wallet pubkey to vouch for")
    .requiredOption(
      "--amount-sol <amount>",
      "SOL amount to stake",
      parseAmountSol
    )
    .requiredOption("--keypair <file>", "Solana keypair JSON file")
    .option("--json", "Print structured JSON output")
    .addHelpText(
      "after",
      "\nExamples:\n  agentvouch vouch create --author asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw --amount-sol 0.1 --keypair ~/.config/solana/id.json"
    )
    .action(
      async (options: {
        author: string;
        amountSol: number;
        keypair: string;
        rpcUrl: string;
        json?: boolean;
      }) => {
        await runCommand(
          options,
          async () => {
            const keypair = loadKeypair(options.keypair);
            const solana = new AgentVouchSolanaClient(
              keypair,
              resolveRpcUrl(options.rpcUrl)
            );
            return solana.vouch(options.author, options.amountSol);
          },
          formatCreateVouchResult
        );
      }
    )
);

addRpcUrlOption(
  vouch
    .command("claim")
    .requiredOption("--author <pubkey>", "Author wallet pubkey you vouched for")
    .requiredOption(
      "--skill-listing <address>",
      "Skill listing PDA that holds unclaimed voucher revenue"
    )
    .requiredOption("--keypair <file>", "Solana keypair JSON file")
    .option("--json", "Print structured JSON output")
    .addHelpText(
      "after",
      "\nExamples:\n  agentvouch vouch claim --author asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw --skill-listing Eq35iaSKECtZAGMkPVSk18tqFDFe6L3hgEhJsUzkByFd --keypair ~/.config/solana/id.json"
    )
    .action(
      async (options: {
        author: string;
        skillListing: string;
        keypair: string;
        rpcUrl: string;
        json?: boolean;
      }) => {
        await runCommand(
          options,
          async () => {
            const keypair = loadKeypair(options.keypair);
            const solana = new AgentVouchSolanaClient(
              keypair,
              resolveRpcUrl(options.rpcUrl)
            );
            return solana.claimVoucherRevenue(
              options.skillListing,
              options.author
            );
          },
          (result) => [
            `claimed voucher revenue`,
            `listing: ${result.skillListing}`,
            `vouch: ${result.vouch}`,
            `voucher_profile: ${result.voucherProfile}`,
            `author_profile: ${result.authorProfile}`,
            `tx: ${result.tx}`,
          ]
        );
      }
    )
);

  return program;
}
