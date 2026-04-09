#!/usr/bin/env node

import { Command } from "commander";
import cliPackage from "../package.json";
import { resolveBaseUrl, resolveRpcUrl } from "./lib/config.js";
import {
  AgentVouchApiClient,
  type ListSkillsOptions,
  type SkillListResponse,
  type SkillRecord,
} from "./lib/http.js";
import { installSkill } from "./lib/install.js";
import { runCommand } from "./lib/output.js";
import { addSkillVersion, publishSkill } from "./lib/publish.js";
import { loadKeypair } from "./lib/signer.js";
import { AgentVouchSolanaClient } from "./lib/solana.js";

function parseLamports(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Expected a non-negative integer lamport amount.");
  }
  return parsed;
}

function parseAmountSol(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected a positive SOL amount.");
  }
  return parsed;
}

function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Expected a positive page number.");
  }
  return parsed;
}

function formatSkillSummary(skill: SkillRecord): string[] {
  return [
    `${skill.name}`,
    `id: ${skill.id}`,
    `skill_id: ${skill.skill_id}`,
    `source: ${skill.source ?? "repo"}`,
    `author: ${skill.author_pubkey}`,
    `price_lamports: ${skill.price_lamports ?? 0}`,
    `listing: ${skill.on_chain_address ?? "none"}`,
    `registered: ${skill.author_trust?.isRegistered ? "yes" : "no"}`,
    `active_author_disputes: ${skill.author_trust?.activeAuthorDisputes ?? 0}`,
    `upheld_author_disputes: ${skill.author_trust?.upheldAuthorDisputes ?? 0}`,
  ];
}

function formatSkillList(result: SkillListResponse): string[] {
  if (result.skills.length === 0) {
    return [
      "no skills found",
      `page: ${result.pagination.page}`,
      `page_size: ${result.pagination.pageSize}`,
      `total: ${result.pagination.total}`,
      `total_pages: ${result.pagination.totalPages}`,
    ];
  }

  const lines: string[] = [];

  for (const [index, skill] of result.skills.entries()) {
    lines.push(...formatSkillSummary(skill));
    if (index < result.skills.length - 1) {
      lines.push("");
    }
  }

  lines.push(
    "",
    `page: ${result.pagination.page}`,
    `page_size: ${result.pagination.pageSize}`,
    `total: ${result.pagination.total}`,
    `total_pages: ${result.pagination.totalPages}`
  );

  return lines;
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
    .option("--sort <order>", "Sort by newest, trusted, installs, or name", "newest")
    .option("--page <number>", "Results page number", parsePage, 1)
    .option("--json", "Print structured JSON output")
    .addHelpText(
      "after",
      "\nExamples:\n  agentvouch skill list\n  agentvouch skill list --q calendar --sort trusted\n  agentvouch skill list --author asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw --page 2 --json"
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
            new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).listSkills({
              q: options.q,
              author: options.author,
              tags: options.tags,
              sort: options.sort,
              page: options.page,
            }),
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
      "\nExamples:\n  agentvouch skill inspect 595f5534-07ae-4839-a45a-b6858ab731fe\n  agentvouch skill inspect chain-Eq35iaSKECtZAGMkPVSk18tqFDFe6L3hgEhJsUzkByFd --json"
    )
    .action(async (id: string, options: { baseUrl: string; json?: boolean }) => {
      await runCommand(
        options,
        async () => new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).getSkill(id),
        formatSkillSummary
      );
    })
);

addRpcUrlOption(
  addBaseUrlOption(
    skill
      .command("install")
      .argument("<id>", "Repo UUID or chain-<listing> id")
      .requiredOption("--out <path>", "Output path for the downloaded skill file", "SKILL.md")
      .option("--keypair <file>", "Solana keypair JSON file for paid installs")
      .option("--force", "Overwrite an existing output file")
      .option("--dry-run", "Show the required paid flow without purchasing or writing")
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
              `price_lamports: ${result.priceLamports}`,
              ...(result.listingAddress ? [`listing: ${result.listingAddress}`] : []),
              ...(result.purchaseTx ? [`purchase_tx: ${result.purchaseTx}`] : []),
              ...(result.dryRun ? ["dry_run: true"] : []),
            ]
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
        "--price-lamports <lamports>",
        "Listing price in lamports",
        parseLamports,
        1_000_000
      )
      .option("--dry-run", "Preview the repo and on-chain requests without sending them")
      .option("--json", "Print structured JSON output")
      .addHelpText(
        "after",
        "\nExamples:\n  agentvouch skill publish --file ./SKILL.md --skill-id calendar-agent --name \"Calendar Agent\" --description \"Books and manages calendar tasks\" --keypair ~/.config/solana/id.json\n  agentvouch skill publish --file ./SKILL.md --skill-id calendar-agent --name \"Calendar Agent\" --description \"Books and manages calendar tasks\" --price-lamports 0 --keypair ~/.config/solana/id.json --dry-run"
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
                    `price_lamports: ${result.onChainListing.priceLamports}`,
                    "dry_run: true",
                  ]
                : [
                    `repo_id: ${result.repoSkillId}`,
                    `listing: ${result.listingAddress}`,
                    `skill_uri: ${result.skillUri}`,
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

const skillVersion = skill.command("version").description("Manage repo skill versions.");

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
      "\nExamples:\n  agentvouch skill version add 595f5534-07ae-4839-a45a-b6858ab731fe --file ./SKILL.md --changelog \"Fix env var names\" --keypair ~/.config/solana/id.json"
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

const author = program.command("author").description("Manage author profile actions.");

addRpcUrlOption(
  author
    .command("register")
    .requiredOption("--keypair <file>", "Solana keypair JSON file")
    .option("--metadata-uri <uri>", "Metadata URI for the agent profile", "")
    .option("--json", "Print structured JSON output")
    .addHelpText(
      "after",
      "\nExamples:\n  agentvouch author register --keypair ~/.config/solana/id.json --metadata-uri https://example.com/agent.json"
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
          (result) => [
            `author: ${result.agentProfile}`,
            `already_registered: ${result.alreadyRegistered ? "yes" : "no"}`,
            ...(result.tx ? [`tx: ${result.tx}`] : []),
          ]
        );
      }
    )
);

const vouch = program.command("vouch").description("Create stake-backed vouches.");

addRpcUrlOption(
  vouch
    .command("create")
    .requiredOption("--author <pubkey>", "Author wallet pubkey to vouch for")
    .requiredOption("--amount-sol <amount>", "SOL amount to stake", parseAmountSol)
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
          (result) => [
            `vouch: ${result.vouch}`,
            `already_exists: ${result.alreadyExists ? "yes" : "no"}`,
            ...(result.lamports ? [`lamports: ${result.lamports}`] : []),
            ...(result.tx ? [`tx: ${result.tx}`] : []),
          ]
        );
      }
    )
);

await program.parseAsync(process.argv);
