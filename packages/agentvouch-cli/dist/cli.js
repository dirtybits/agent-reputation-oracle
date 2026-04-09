#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";

// package.json
var package_default = {
  name: "@agentvouch/cli",
  version: "0.1.0",
  private: true,
  type: "module",
  bin: {
    agentvouch: "./dist/cli.js"
  },
  scripts: {
    build: "tsup src/cli.ts --format esm --dts --sourcemap --clean --out-dir dist",
    dev: "tsx src/cli.ts",
    test: "vitest run"
  },
  dependencies: {
    "@agentvouch/protocol": "0.1.0",
    "@coral-xyz/anchor": "^0.32.1",
    "@solana/web3.js": "^1.98.4",
    commander: "^14.0.3",
    tweetnacl: "^1.0.3"
  },
  devDependencies: {
    "@types/node": "^25.5.0",
    tsup: "^8.5.1",
    tsx: "^4.21.0",
    vitest: "^4.1.2"
  }
};

// src/lib/config.ts
import {
  AGENTVOUCH_DEFAULT_BASE_URL,
  AGENTVOUCH_DEFAULT_RPC_URL
} from "@agentvouch/protocol";
function resolveBaseUrl(baseUrl) {
  return (baseUrl || process.env.AGENTVOUCH_BASE_URL || AGENTVOUCH_DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
}
function resolveRpcUrl(rpcUrl) {
  return (rpcUrl || process.env.AGENTVOUCH_RPC_URL || process.env.ANCHOR_PROVIDER_URL || AGENTVOUCH_DEFAULT_RPC_URL).trim();
}

// src/lib/errors.ts
var CliError = class extends Error {
  exitCode;
  data;
  constructor(message, opts) {
    super(message);
    this.name = "CliError";
    this.exitCode = opts?.exitCode ?? 1;
    this.data = opts?.data;
  }
};
function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return "Unknown error";
}

// src/lib/http.ts
function getJsonContentType(response) {
  return (response.headers.get("content-type") || "").includes(
    "application/json"
  );
}
function parsePaymentRequirement(response, body) {
  const header = response.headers.get("x-payment");
  if (header) {
    try {
      return JSON.parse(header);
    } catch {
      return void 0;
    }
  }
  if (body && typeof body === "object" && "requirement" in body && body.requirement) {
    return body.requirement;
  }
  return void 0;
}
var AgentVouchApiClient = class {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  url(pathname) {
    return `${this.baseUrl}${pathname}`;
  }
  async listSkills(options = {}) {
    const searchParams = new URLSearchParams();
    if (options.q) {
      searchParams.set("q", options.q);
    }
    if (options.sort) {
      searchParams.set("sort", options.sort);
    }
    if (options.author) {
      searchParams.set("author", options.author);
    }
    if (options.tags) {
      searchParams.set("tags", options.tags);
    }
    if (options.page !== void 0) {
      searchParams.set("page", String(options.page));
    }
    const query = searchParams.toString();
    const response = await fetch(
      this.url(`/api/skills${query ? `?${query}` : ""}`)
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || "error" in body || !Array.isArray(body.skills) || !body.pagination) {
      throw new CliError(
        `Failed to list skills: ${body?.error || response.statusText}`,
        { exitCode: 1, data: body }
      );
    }
    return body;
  }
  async getSkill(id) {
    const response = await fetch(this.url(`/api/skills/${id}`));
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || "error" in body) {
      throw new CliError(
        `Failed to inspect skill ${id}: ${body?.error || response.statusText}`,
        { exitCode: 1, data: body }
      );
    }
    return body;
  }
  async listAuthors(options = {}) {
    const pathname = options.trusted ? "/api/index/trusted-authors" : "/api/index/authors";
    const response = await fetch(this.url(pathname));
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || "error" in body || !Array.isArray(body.authors)) {
      throw new CliError(
        `Failed to list authors: ${body?.error || response.statusText}`,
        { exitCode: 1, data: body }
      );
    }
    return body;
  }
  async fetchRemoteText(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new CliError(
        `Failed to fetch skill content from ${url}: ${response.status} ${response.statusText}`
      );
    }
    return response.text();
  }
  async downloadRaw(id, auth) {
    const response = await fetch(this.url(`/api/skills/${id}/raw`), {
      headers: auth ? { "X-AgentVouch-Auth": JSON.stringify(auth) } : void 0
    });
    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        content: await response.text()
      };
    }
    const body = getJsonContentType(response) ? await response.json().catch(() => null) : null;
    return {
      ok: false,
      status: response.status,
      error: body?.error || await response.text().catch(() => response.statusText) || response.statusText,
      requirement: parsePaymentRequirement(response, body)
    };
  }
  async publishSkill(body) {
    const response = await fetch(this.url("/api/skills"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || "error" in payload) {
      throw new CliError(
        `Failed to publish repo skill: ${payload?.error || response.statusText}`,
        { exitCode: 1, data: payload }
      );
    }
    return payload;
  }
  async linkSkillListing(skillId, body) {
    const response = await fetch(this.url(`/api/skills/${skillId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || "error" in payload) {
      throw new CliError(
        `Failed to link repo skill ${skillId} to on-chain listing: ${payload?.error || response.statusText}`,
        { exitCode: 1, data: payload }
      );
    }
    return payload;
  }
  async addSkillVersion(skillId, body) {
    const response = await fetch(this.url(`/api/skills/${skillId}/versions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || "error" in payload) {
      throw new CliError(
        `Failed to add skill version for ${skillId}: ${payload?.error || response.statusText}`,
        { exitCode: 1, data: payload }
      );
    }
    return payload;
  }
};

// src/lib/format.ts
function getTrustFields(skill2) {
  return {
    reputation: skill2.author_trust_summary?.reputationScore ?? skill2.author_trust?.reputationScore ?? 0,
    isRegistered: skill2.author_trust_summary?.isRegistered ?? skill2.author_trust?.isRegistered ?? false,
    recommendedAction: skill2.author_trust_summary?.recommended_action ?? null,
    activeDisputes: skill2.author_trust_summary?.activeDisputesAgainstAuthor ?? skill2.author_trust?.activeDisputesAgainstAuthor ?? 0,
    upheldDisputes: skill2.author_trust_summary?.disputesUpheldAgainstAuthor ?? skill2.author_trust?.disputesUpheldAgainstAuthor ?? 0
  };
}
function formatSkillSummary(skill2) {
  const trust = getTrustFields(skill2);
  return [
    `${skill2.name}`,
    `id: ${skill2.id}`,
    `skill_id: ${skill2.skill_id}`,
    `source: ${skill2.source ?? "repo"}`,
    `author: ${skill2.author_pubkey}`,
    `author_reputation: ${trust.reputation}`,
    `price_lamports: ${skill2.price_lamports ?? 0}`,
    `listing: ${skill2.on_chain_address ?? "none"}`,
    `registered: ${trust.isRegistered ? "yes" : "no"}`,
    ...trust.recommendedAction ? [`recommended_action: ${trust.recommendedAction}`] : [],
    `active_author_disputes: ${trust.activeDisputes}`,
    `upheld_author_disputes: ${trust.upheldDisputes}`
  ];
}
function formatSkillList(result) {
  if (result.skills.length === 0) {
    return [
      "no skills found",
      `page: ${result.pagination.page}`,
      `page_size: ${result.pagination.pageSize}`,
      `total: ${result.pagination.total}`,
      `total_pages: ${result.pagination.totalPages}`
    ];
  }
  const lines = [];
  for (const [index, skill2] of result.skills.entries()) {
    lines.push(...formatSkillSummary(skill2));
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
function getAuthorName(author2) {
  return author2.author_identity?.displayName ?? author2.author_identity?.name ?? author2.canonical_agent_id ?? author2.pubkey;
}
function getAuthorReputation(author2) {
  return author2.author_trust_summary?.reputationScore ?? 0;
}
function formatAuthorSummary(author2) {
  return [
    getAuthorName(author2),
    `author: ${author2.pubkey}`,
    `author_reputation: ${getAuthorReputation(author2)}`,
    `recommended_action: ${author2.recommended_action ?? "unknown"}`,
    `skill_count: ${author2.skill_count ?? author2.trusted_skill_count ?? 0}`,
    ...author2.canonical_agent_id ? [`canonical_agent_id: ${author2.canonical_agent_id}`] : [],
    ...author2.chain_context ? [`chain_context: ${author2.chain_context}`] : []
  ];
}
function formatAuthorList(result) {
  if (result.authors.length === 0) {
    return ["no authors found", `total: ${result.total}`];
  }
  const lines = [];
  for (const [index, author2] of result.authors.entries()) {
    lines.push(...formatAuthorSummary(author2));
    if (index < result.authors.length - 1) {
      lines.push("");
    }
  }
  lines.push("", `total: ${result.total}`);
  return lines;
}

// src/lib/install.ts
import path2 from "path";

// src/lib/fs.ts
import { access, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
async function readUtf8File(filePath) {
  return readFile(filePath, "utf8");
}
async function assertWritableOutputPath(filePath, force = false) {
  if (force) {
    return;
  }
  try {
    await access(filePath);
    throw new CliError(
      `Refusing to overwrite existing file at ${filePath}. Re-run with --force to replace it.`
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
}
async function writeUtf8File(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

// src/lib/signer.ts
import {
  buildDownloadRawMessage,
  buildSignMessage
} from "@agentvouch/protocol";
import { readFileSync } from "fs";
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";
function encodeBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function loadKeypair(keypairPath) {
  try {
    const secret = JSON.parse(readFileSync(keypairPath, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  } catch (error) {
    throw new CliError(
      `Failed to read keypair at ${keypairPath}: ${error instanceof Error ? error.message : "invalid keypair file"}`
    );
  }
}
function signUtf8Message(keypair, message) {
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    keypair.secretKey
  );
  return encodeBase64(signature);
}
function createRepoAuthPayload(keypair, action, timestamp = Date.now()) {
  const message = buildSignMessage(action, timestamp);
  return {
    pubkey: keypair.publicKey.toBase58(),
    signature: signUtf8Message(keypair, message),
    message,
    timestamp
  };
}
function createDownloadAuthPayload(keypair, skillId, listingAddress, timestamp = Date.now()) {
  const message = buildDownloadRawMessage(skillId, listingAddress, timestamp);
  return {
    pubkey: keypair.publicKey.toBase58(),
    signature: signUtf8Message(keypair, message),
    message,
    timestamp
  };
}

// src/lib/solana.ts
import { AGENTVOUCH_PROGRAM_ID } from "@agentvouch/protocol";
import anchor from "@coral-xyz/anchor";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram
} from "@solana/web3.js";

// ../../web/reputation_oracle.json
var reputation_oracle_default = {
  address: "ELmVnLSNuwNca4PfPqeqNowoUF8aDdtfto3rF9d89wf",
  metadata: {
    name: "reputation_oracle",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Created with Anchor"
  },
  instructions: [
    {
      name: "admin_migrate_agent",
      discriminator: [
        203,
        79,
        102,
        176,
        194,
        111,
        179,
        208
      ],
      accounts: [
        {
          name: "agent_profile",
          docs: [
            "validate its owner/discriminator/PDA manually before rewriting it."
          ],
          writable: true
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "authority",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "claim_voucher_revenue",
      discriminator: [
        197,
        41,
        210,
        196,
        139,
        237,
        188,
        183
      ],
      accounts: [
        {
          name: "skill_listing",
          writable: true
        },
        {
          name: "vouch",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  118,
                  111,
                  117,
                  99,
                  104
                ]
              },
              {
                kind: "account",
                path: "voucher_profile"
              },
              {
                kind: "account",
                path: "author_profile"
              }
            ]
          }
        },
        {
          name: "voucher_profile",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "voucher"
              }
            ]
          }
        },
        {
          name: "author_profile",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "skill_listing.author",
                account: "SkillListing"
              }
            ]
          }
        },
        {
          name: "voucher",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "close_skill_listing",
      discriminator: [
        81,
        95,
        50,
        47,
        45,
        66,
        132,
        124
      ],
      accounts: [
        {
          name: "skill_listing",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  115,
                  107,
                  105,
                  108,
                  108
                ]
              },
              {
                kind: "account",
                path: "author"
              },
              {
                kind: "arg",
                path: "skill_id"
              }
            ]
          }
        },
        {
          name: "author_profile",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "author"
              }
            ]
          }
        },
        {
          name: "author",
          writable: true,
          signer: true
        }
      ],
      args: [
        {
          name: "skill_id",
          type: "string"
        }
      ]
    },
    {
      name: "create_skill_listing",
      discriminator: [
        101,
        61,
        26,
        213,
        47,
        75,
        13,
        122
      ],
      accounts: [
        {
          name: "skill_listing",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  115,
                  107,
                  105,
                  108,
                  108
                ]
              },
              {
                kind: "account",
                path: "author"
              },
              {
                kind: "arg",
                path: "skill_id"
              }
            ]
          }
        },
        {
          name: "author_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "author"
              }
            ]
          }
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "author_bond",
          optional: true
        },
        {
          name: "author",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "skill_id",
          type: "string"
        },
        {
          name: "skill_uri",
          type: "string"
        },
        {
          name: "name",
          type: "string"
        },
        {
          name: "description",
          type: "string"
        },
        {
          name: "price_lamports",
          type: "u64"
        }
      ]
    },
    {
      name: "deposit_author_bond",
      discriminator: [
        20,
        24,
        47,
        9,
        171,
        195,
        73,
        223
      ],
      accounts: [
        {
          name: "author_bond",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  95,
                  98,
                  111,
                  110,
                  100
                ]
              },
              {
                kind: "account",
                path: "author"
              }
            ]
          }
        },
        {
          name: "author_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "author"
              }
            ]
          }
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "author",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "amount",
          type: "u64"
        }
      ]
    },
    {
      name: "initialize_config",
      discriminator: [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      accounts: [
        {
          name: "config",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "authority",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "min_stake",
          type: "u64"
        },
        {
          name: "dispute_bond",
          type: "u64"
        },
        {
          name: "min_author_bond_for_free_listing",
          type: "u64"
        },
        {
          name: "slash_percentage",
          type: "u8"
        },
        {
          name: "cooldown_period",
          type: "i64"
        }
      ]
    },
    {
      name: "migrate_agent",
      discriminator: [
        102,
        150,
        249,
        223,
        92,
        169,
        131,
        39
      ],
      accounts: [
        {
          name: "agent_profile",
          docs: [
            "because the stored bump may be at a stale offset after a struct layout change.",
            "Seeds and owner are validated; we rewrite the account data manually."
          ],
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "authority"
              }
            ]
          }
        },
        {
          name: "authority",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "metadata_uri",
          type: "string"
        }
      ]
    },
    {
      name: "migrate_config",
      discriminator: [
        92,
        131,
        58,
        105,
        210,
        154,
        224,
        193
      ],
      accounts: [
        {
          name: "config",
          docs: [
            "deserialized as `Account<ReputationConfig>` yet. Seeds and ownership are",
            "validated here, then the account is rewritten manually."
          ],
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "authority",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "open_author_dispute",
      discriminator: [
        37,
        162,
        204,
        185,
        218,
        143,
        241,
        119
      ],
      accounts: [
        {
          name: "author_dispute",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  95,
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                kind: "account",
                path: "author_profile.authority",
                account: "AgentProfile"
              },
              {
                kind: "arg",
                path: "dispute_id"
              }
            ]
          }
        },
        {
          name: "author_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "author_profile.authority",
                account: "AgentProfile"
              }
            ]
          }
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "skill_listing"
        },
        {
          name: "purchase",
          optional: true
        },
        {
          name: "challenger",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "dispute_id",
          type: "u64"
        },
        {
          name: "reason",
          type: {
            defined: {
              name: "AuthorDisputeReason"
            }
          }
        },
        {
          name: "evidence_uri",
          type: "string"
        }
      ]
    },
    {
      name: "purchase_skill",
      discriminator: [
        70,
        41,
        105,
        156,
        159,
        169,
        215,
        188
      ],
      accounts: [
        {
          name: "skill_listing",
          writable: true
        },
        {
          name: "purchase",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  112,
                  117,
                  114,
                  99,
                  104,
                  97,
                  115,
                  101
                ]
              },
              {
                kind: "account",
                path: "buyer"
              },
              {
                kind: "account",
                path: "skill_listing"
              }
            ]
          }
        },
        {
          name: "author",
          writable: true
        },
        {
          name: "author_profile",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "skill_listing.author",
                account: "SkillListing"
              }
            ]
          }
        },
        {
          name: "buyer",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "register_agent",
      discriminator: [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      accounts: [
        {
          name: "agent_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "authority"
              }
            ]
          }
        },
        {
          name: "authority",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "metadata_uri",
          type: "string"
        }
      ]
    },
    {
      name: "remove_skill_listing",
      discriminator: [
        196,
        216,
        174,
        251,
        211,
        35,
        48,
        33
      ],
      accounts: [
        {
          name: "skill_listing",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  115,
                  107,
                  105,
                  108,
                  108
                ]
              },
              {
                kind: "account",
                path: "author"
              },
              {
                kind: "arg",
                path: "skill_id"
              }
            ]
          }
        },
        {
          name: "author_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "author"
              }
            ]
          }
        },
        {
          name: "author",
          writable: true,
          signer: true
        }
      ],
      args: [
        {
          name: "skill_id",
          type: "string"
        }
      ]
    },
    {
      name: "repair_agent_registered_at",
      discriminator: [
        7,
        147,
        128,
        160,
        11,
        176,
        124,
        76
      ],
      accounts: [
        {
          name: "agent_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "agent_profile.authority",
                account: "AgentProfile"
              }
            ]
          }
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "authority",
          signer: true
        }
      ],
      args: [
        {
          name: "registered_at",
          type: "i64"
        }
      ]
    },
    {
      name: "resolve_author_dispute",
      discriminator: [
        104,
        27,
        60,
        182,
        26,
        232,
        213,
        247
      ],
      accounts: [
        {
          name: "author_dispute",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  95,
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                kind: "account",
                path: "author_profile.authority",
                account: "AgentProfile"
              },
              {
                kind: "arg",
                path: "dispute_id"
              }
            ]
          }
        },
        {
          name: "author_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "author_profile.authority",
                account: "AgentProfile"
              }
            ]
          }
        },
        {
          name: "author_bond",
          writable: true,
          optional: true
        },
        {
          name: "config",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "authority",
          signer: true
        },
        {
          name: "challenger",
          writable: true
        }
      ],
      args: [
        {
          name: "dispute_id",
          type: "u64"
        },
        {
          name: "ruling",
          type: {
            defined: {
              name: "AuthorDisputeRuling"
            }
          }
        }
      ]
    },
    {
      name: "revoke_vouch",
      discriminator: [
        166,
        31,
        99,
        31,
        23,
        223,
        96,
        78
      ],
      accounts: [
        {
          name: "vouch",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  118,
                  111,
                  117,
                  99,
                  104
                ]
              },
              {
                kind: "account",
                path: "voucher_profile"
              },
              {
                kind: "account",
                path: "vouchee_profile"
              }
            ]
          }
        },
        {
          name: "voucher_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "voucher"
              }
            ]
          }
        },
        {
          name: "vouchee_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "vouchee_profile.authority",
                account: "AgentProfile"
              }
            ]
          }
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "voucher",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "update_skill_listing",
      discriminator: [
        192,
        205,
        6,
        209,
        45,
        93,
        143,
        10
      ],
      accounts: [
        {
          name: "skill_listing",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  115,
                  107,
                  105,
                  108,
                  108
                ]
              },
              {
                kind: "account",
                path: "author"
              },
              {
                kind: "arg",
                path: "skill_id"
              }
            ]
          }
        },
        {
          name: "author_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "author"
              }
            ]
          }
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "author_bond",
          optional: true
        },
        {
          name: "author",
          signer: true
        }
      ],
      args: [
        {
          name: "skill_id",
          type: "string"
        },
        {
          name: "skill_uri",
          type: "string"
        },
        {
          name: "name",
          type: "string"
        },
        {
          name: "description",
          type: "string"
        },
        {
          name: "price_lamports",
          type: "u64"
        }
      ]
    },
    {
      name: "vouch",
      discriminator: [
        87,
        240,
        8,
        21,
        219,
        179,
        242,
        177
      ],
      accounts: [
        {
          name: "vouch",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  118,
                  111,
                  117,
                  99,
                  104
                ]
              },
              {
                kind: "account",
                path: "voucher_profile"
              },
              {
                kind: "account",
                path: "vouchee_profile"
              }
            ]
          }
        },
        {
          name: "voucher_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "voucher"
              }
            ]
          }
        },
        {
          name: "vouchee_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "vouchee_profile.authority",
                account: "AgentProfile"
              }
            ]
          }
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "voucher",
          writable: true,
          signer: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "stake_amount",
          type: "u64"
        }
      ]
    },
    {
      name: "withdraw_author_bond",
      discriminator: [
        153,
        203,
        38,
        142,
        135,
        67,
        201,
        179
      ],
      accounts: [
        {
          name: "author_bond",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  95,
                  98,
                  111,
                  110,
                  100
                ]
              },
              {
                kind: "account",
                path: "author"
              }
            ]
          }
        },
        {
          name: "author_profile",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "author"
              }
            ]
          }
        },
        {
          name: "config",
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "author",
          writable: true,
          signer: true
        }
      ],
      args: [
        {
          name: "amount",
          type: "u64"
        }
      ]
    }
  ],
  accounts: [
    {
      name: "AgentProfile",
      discriminator: [
        60,
        227,
        42,
        24,
        0,
        87,
        86,
        205
      ]
    },
    {
      name: "AuthorBond",
      discriminator: [
        179,
        13,
        148,
        157,
        91,
        243,
        120,
        251
      ]
    },
    {
      name: "AuthorDispute",
      discriminator: [
        241,
        8,
        1,
        66,
        88,
        235,
        140,
        242
      ]
    },
    {
      name: "Purchase",
      discriminator: [
        33,
        203,
        1,
        252,
        231,
        228,
        8,
        67
      ]
    },
    {
      name: "ReputationConfig",
      discriminator: [
        46,
        222,
        226,
        114,
        243,
        60,
        242,
        75
      ]
    },
    {
      name: "SkillListing",
      discriminator: [
        133,
        247,
        251,
        51,
        57,
        31,
        57,
        30
      ]
    },
    {
      name: "Vouch",
      discriminator: [
        151,
        175,
        234,
        54,
        134,
        101,
        175,
        210
      ]
    }
  ],
  events: [
    {
      name: "AuthorBondDeposited",
      discriminator: [
        64,
        29,
        156,
        145,
        103,
        85,
        128,
        109
      ]
    },
    {
      name: "AuthorBondSlashed",
      discriminator: [
        130,
        211,
        170,
        231,
        166,
        39,
        233,
        90
      ]
    },
    {
      name: "AuthorBondWithdrawn",
      discriminator: [
        157,
        11,
        206,
        189,
        41,
        171,
        136,
        119
      ]
    },
    {
      name: "AuthorDisputeOpened",
      discriminator: [
        28,
        81,
        192,
        228,
        95,
        182,
        238,
        30
      ]
    },
    {
      name: "AuthorDisputeResolved",
      discriminator: [
        126,
        245,
        151,
        187,
        8,
        65,
        225,
        35
      ]
    },
    {
      name: "AuthorDisputeVouchLinked",
      discriminator: [
        134,
        76,
        190,
        203,
        227,
        59,
        164,
        232
      ]
    },
    {
      name: "RevenueClaimed",
      discriminator: [
        5,
        254,
        104,
        87,
        133,
        137,
        45,
        116
      ]
    },
    {
      name: "SkillListingCreated",
      discriminator: [
        70,
        77,
        153,
        20,
        48,
        144,
        124,
        224
      ]
    },
    {
      name: "SkillListingUpdated",
      discriminator: [
        15,
        130,
        53,
        156,
        202,
        204,
        118,
        7
      ]
    },
    {
      name: "SkillPurchased",
      discriminator: [
        90,
        255,
        155,
        123,
        29,
        16,
        39,
        75
      ]
    },
    {
      name: "VouchCreated",
      discriminator: [
        127,
        98,
        245,
        5,
        1,
        172,
        112,
        42
      ]
    },
    {
      name: "VouchRevoked",
      discriminator: [
        229,
        20,
        21,
        98,
        75,
        95,
        120,
        64
      ]
    }
  ],
  errors: [
    {
      code: 6e3,
      name: "AuthorDisputeNotOpen",
      msg: "Author dispute is not open"
    },
    {
      code: 6001,
      name: "AuthorMismatch",
      msg: "The disputed author does not match this author dispute"
    },
    {
      code: 6002,
      name: "UnauthorizedResolver",
      msg: "Only the configured authority can resolve author disputes"
    },
    {
      code: 6003,
      name: "ChallengerMismatch",
      msg: "Challenger account mismatch"
    },
    {
      code: 6004,
      name: "InsufficientFunds",
      msg: "Insufficient funds"
    },
    {
      code: 6005,
      name: "IncompleteBackingSnapshot",
      msg: "Author dispute cannot resolve without its full author-wide backing snapshot"
    },
    {
      code: 6006,
      name: "InvalidSettlementAccounts",
      msg: "Author dispute uphold must include every snapshotted backing vouch account triple"
    },
    {
      code: 6007,
      name: "DuplicateSettlementBackingVouch",
      msg: "Duplicate backing vouches are not allowed during settlement"
    },
    {
      code: 6008,
      name: "AuthorDisputeVouchLinkMismatch",
      msg: "Settlement link does not match this author dispute"
    },
    {
      code: 6009,
      name: "AuthorDisputeSettlementVouchMismatch",
      msg: "Settlement vouch does not match the recorded author dispute link"
    },
    {
      code: 6010,
      name: "BackingVouchAuthorMismatch",
      msg: "Backing vouch does not belong to the disputed author"
    },
    {
      code: 6011,
      name: "BackingVouchVoucherMismatch",
      msg: "Backing vouch voucher profile does not match the recorded voucher"
    },
    {
      code: 6012,
      name: "BackingVouchNotSlashable",
      msg: "Backing vouch can no longer be slashed through this author dispute"
    },
    {
      code: 6013,
      name: "BackingVouchCountOverflow",
      msg: "Backing vouch count overflow"
    },
    {
      code: 6014,
      name: "SlashAmountOverflow",
      msg: "Slash amount overflow"
    },
    {
      code: 6015,
      name: "MissingAuthorBondForSettlement",
      msg: "Resolver must provide the author's bond account when bond capital exists"
    },
    {
      code: 6016,
      name: "AuthorBondAccountMismatch",
      msg: "Author bond PDA does not match the expected author"
    },
    {
      code: 6017,
      name: "AuthorBondProfileMismatch",
      msg: "Author bond account does not match the author profile totals"
    },
    {
      code: 6018,
      name: "InvalidSettlementAmounts",
      msg: "Resolved voucher slash amounts did not match the expected liability"
    },
    {
      code: 6019,
      name: "BondOnlyDisputeMustNotProvideSettlementAccounts",
      msg: "Bond-only disputes must not include voucher settlement accounts"
    },
    {
      code: 6020,
      name: "OpenAuthorDisputeCountUnderflow",
      msg: "Open author dispute count underflowed"
    }
  ],
  types: [
    {
      name: "AgentProfile",
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            type: "pubkey"
          },
          {
            name: "metadata_uri",
            type: "string"
          },
          {
            name: "reputation_score",
            type: "u64"
          },
          {
            name: "total_vouches_received",
            type: "u32"
          },
          {
            name: "total_vouches_given",
            type: "u32"
          },
          {
            name: "total_staked_for",
            type: "u64"
          },
          {
            name: "author_bond_lamports",
            type: "u64"
          },
          {
            name: "active_free_skill_listings",
            type: "u32"
          },
          {
            name: "open_author_disputes",
            type: "u32"
          },
          {
            name: "registered_at",
            type: "i64"
          },
          {
            name: "bump",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "AuthorBond",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "amount",
            type: "u64"
          },
          {
            name: "created_at",
            type: "i64"
          },
          {
            name: "updated_at",
            type: "i64"
          },
          {
            name: "bump",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "AuthorBondDeposited",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author_bond",
            type: "pubkey"
          },
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "amount",
            type: "u64"
          },
          {
            name: "total_bond_amount",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "AuthorBondSlashed",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author_bond",
            type: "pubkey"
          },
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "amount",
            type: "u64"
          },
          {
            name: "remaining_bond_amount",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "AuthorBondWithdrawn",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author_bond",
            type: "pubkey"
          },
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "amount",
            type: "u64"
          },
          {
            name: "total_bond_amount",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "AuthorDispute",
      type: {
        kind: "struct",
        fields: [
          {
            name: "dispute_id",
            type: "u64"
          },
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "challenger",
            type: "pubkey"
          },
          {
            name: "reason",
            type: {
              defined: {
                name: "AuthorDisputeReason"
              }
            }
          },
          {
            name: "evidence_uri",
            type: "string"
          },
          {
            name: "status",
            type: {
              defined: {
                name: "AuthorDisputeStatus"
              }
            }
          },
          {
            name: "ruling",
            type: {
              option: {
                defined: {
                  name: "AuthorDisputeRuling"
                }
              }
            }
          },
          {
            name: "liability_scope",
            type: {
              defined: {
                name: "AuthorDisputeLiabilityScope"
              }
            }
          },
          {
            name: "skill_listing",
            type: "pubkey"
          },
          {
            name: "skill_price_lamports_snapshot",
            type: "u64"
          },
          {
            name: "purchase",
            type: {
              option: "pubkey"
            }
          },
          {
            name: "backing_vouch_count_snapshot",
            type: "u32"
          },
          {
            name: "linked_vouch_count",
            type: "u32"
          },
          {
            name: "bond_amount",
            type: "u64"
          },
          {
            name: "created_at",
            type: "i64"
          },
          {
            name: "resolved_at",
            type: {
              option: "i64"
            }
          },
          {
            name: "bump",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "AuthorDisputeLiabilityScope",
      type: {
        kind: "enum",
        variants: [
          {
            name: "AuthorBondOnly"
          },
          {
            name: "AuthorBondThenVouchers"
          }
        ]
      }
    },
    {
      name: "AuthorDisputeOpened",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author_dispute",
            type: "pubkey"
          },
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "challenger",
            type: "pubkey"
          },
          {
            name: "reason",
            type: "string"
          },
          {
            name: "liability_scope",
            type: "string"
          },
          {
            name: "skill_listing",
            type: "pubkey"
          },
          {
            name: "skill_price_lamports_snapshot",
            type: "u64"
          },
          {
            name: "purchase",
            type: {
              option: "pubkey"
            }
          },
          {
            name: "linked_vouch_count",
            type: "u32"
          },
          {
            name: "bond_amount",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "AuthorDisputeReason",
      type: {
        kind: "enum",
        variants: [
          {
            name: "MaliciousSkill"
          },
          {
            name: "FraudulentClaims"
          },
          {
            name: "FailedDelivery"
          },
          {
            name: "Other"
          }
        ]
      }
    },
    {
      name: "AuthorDisputeResolved",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author_dispute",
            type: "pubkey"
          },
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "ruling",
            type: "string"
          },
          {
            name: "liability_scope",
            type: "string"
          },
          {
            name: "linked_vouch_count",
            type: "u32"
          },
          {
            name: "author_bond_slashed_amount",
            type: "u64"
          },
          {
            name: "voucher_slashed_amount",
            type: "u64"
          },
          {
            name: "slashed_amount",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "AuthorDisputeRuling",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Upheld"
          },
          {
            name: "Dismissed"
          }
        ]
      }
    },
    {
      name: "AuthorDisputeStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Open"
          },
          {
            name: "Resolved"
          }
        ]
      }
    },
    {
      name: "AuthorDisputeVouchLinked",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author_dispute",
            type: "pubkey"
          },
          {
            name: "vouch",
            type: "pubkey"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "Purchase",
      type: {
        kind: "struct",
        fields: [
          {
            name: "buyer",
            type: "pubkey"
          },
          {
            name: "skill_listing",
            type: "pubkey"
          },
          {
            name: "purchased_at",
            type: "i64"
          },
          {
            name: "price_paid",
            type: "u64"
          },
          {
            name: "bump",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "ReputationConfig",
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            type: "pubkey"
          },
          {
            name: "min_stake",
            type: "u64"
          },
          {
            name: "dispute_bond",
            type: "u64"
          },
          {
            name: "min_author_bond_for_free_listing",
            type: "u64"
          },
          {
            name: "slash_percentage",
            type: "u8"
          },
          {
            name: "cooldown_period",
            type: "i64"
          },
          {
            name: "stake_weight",
            type: "u32"
          },
          {
            name: "vouch_weight",
            type: "u32"
          },
          {
            name: "longevity_bonus",
            type: "u32"
          },
          {
            name: "bump",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "RevenueClaimed",
      type: {
        kind: "struct",
        fields: [
          {
            name: "skill_listing",
            type: "pubkey"
          },
          {
            name: "vouch",
            type: "pubkey"
          },
          {
            name: "voucher",
            type: "pubkey"
          },
          {
            name: "amount",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "SkillListing",
      type: {
        kind: "struct",
        fields: [
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "skill_uri",
            type: "string"
          },
          {
            name: "name",
            type: "string"
          },
          {
            name: "description",
            type: "string"
          },
          {
            name: "price_lamports",
            type: "u64"
          },
          {
            name: "total_downloads",
            type: "u64"
          },
          {
            name: "total_revenue",
            type: "u64"
          },
          {
            name: "unclaimed_voucher_revenue",
            type: "u64"
          },
          {
            name: "created_at",
            type: "i64"
          },
          {
            name: "updated_at",
            type: "i64"
          },
          {
            name: "status",
            type: {
              defined: {
                name: "SkillStatus"
              }
            }
          },
          {
            name: "bump",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "SkillListingCreated",
      type: {
        kind: "struct",
        fields: [
          {
            name: "skill_listing",
            type: "pubkey"
          },
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "name",
            type: "string"
          },
          {
            name: "price_lamports",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "SkillListingUpdated",
      type: {
        kind: "struct",
        fields: [
          {
            name: "skill_listing",
            type: "pubkey"
          },
          {
            name: "author",
            type: "pubkey"
          },
          {
            name: "name",
            type: "string"
          },
          {
            name: "price_lamports",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "SkillPurchased",
      type: {
        kind: "struct",
        fields: [
          {
            name: "purchase",
            type: "pubkey"
          },
          {
            name: "skill_listing",
            type: "pubkey"
          },
          {
            name: "buyer",
            type: "pubkey"
          },
          {
            name: "price",
            type: "u64"
          },
          {
            name: "author_share",
            type: "u64"
          },
          {
            name: "voucher_pool",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "SkillStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Active"
          },
          {
            name: "Suspended"
          },
          {
            name: "Removed"
          }
        ]
      }
    },
    {
      name: "Vouch",
      type: {
        kind: "struct",
        fields: [
          {
            name: "voucher",
            type: "pubkey"
          },
          {
            name: "vouchee",
            type: "pubkey"
          },
          {
            name: "stake_amount",
            type: "u64"
          },
          {
            name: "created_at",
            type: "i64"
          },
          {
            name: "status",
            type: {
              defined: {
                name: "VouchStatus"
              }
            }
          },
          {
            name: "cumulative_revenue",
            type: "u64"
          },
          {
            name: "last_payout_at",
            type: "i64"
          },
          {
            name: "bump",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "VouchCreated",
      type: {
        kind: "struct",
        fields: [
          {
            name: "vouch",
            type: "pubkey"
          },
          {
            name: "voucher",
            type: "pubkey"
          },
          {
            name: "vouchee",
            type: "pubkey"
          },
          {
            name: "stake_amount",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "VouchRevoked",
      type: {
        kind: "struct",
        fields: [
          {
            name: "vouch",
            type: "pubkey"
          },
          {
            name: "voucher",
            type: "pubkey"
          },
          {
            name: "vouchee",
            type: "pubkey"
          },
          {
            name: "stake_returned",
            type: "u64"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "VouchStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Active"
          },
          {
            name: "Revoked"
          },
          {
            name: "Slashed"
          }
        ]
      }
    }
  ]
};

// src/lib/solana.ts
var { AnchorProvider, Program, Wallet, web3 } = anchor;
var MIN_SKILL_PRICE_LAMPORTS = 1000000n;
function toPublicKey(value) {
  return value instanceof PublicKey ? value : new PublicKey(value);
}
function toLamportsBigInt(value, fieldName) {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error(`${fieldName} must be non-negative.`);
    }
    return value;
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${fieldName} exceeds JavaScript's safe integer range.`
    );
  }
  return BigInt(value);
}
function toLamportsBn(value, fieldName) {
  return new anchor.BN(toLamportsBigInt(value, fieldName).toString());
}
function toStakeLamports(amountSol) {
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    throw new Error("amountSol must be a positive SOL amount.");
  }
  const lamports = amountSol * LAMPORTS_PER_SOL;
  if (!Number.isFinite(lamports) || !Number.isInteger(lamports)) {
    throw new Error(
      "amountSol must convert to a whole lamport amount."
    );
  }
  if (!Number.isSafeInteger(lamports)) {
    throw new Error(
      "amountSol exceeds JavaScript's safe integer range in lamports."
    );
  }
  return BigInt(lamports);
}
function assertSupportedListingPrice(priceLamports) {
  if (priceLamports !== 0n && priceLamports < MIN_SKILL_PRICE_LAMPORTS) {
    throw new Error(
      `priceLamports must be 0 or at least ${MIN_SKILL_PRICE_LAMPORTS.toString()} lamports.`
    );
  }
}
var AgentVouchSolanaClient = class {
  constructor(keypair, rpcUrl, commitment = "confirmed") {
    this.keypair = keypair;
    this.connection = new web3.Connection(rpcUrl, commitment);
    this.provider = new AnchorProvider(this.connection, new Wallet(keypair), {
      commitment
    });
    this.program = new Program(
      reputation_oracle_default,
      this.provider
    );
  }
  connection;
  provider;
  program;
  get authority() {
    return this.keypair.publicKey;
  }
  getConfigAddress() {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }
  getAgentProfileAddress(authority) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), toPublicKey(authority).toBuffer()],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }
  getAuthorBondAddress(authority) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("author_bond"), toPublicKey(authority).toBuffer()],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }
  getSkillListingAddress(skillId, author2 = this.authority) {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("skill"),
        toPublicKey(author2).toBuffer(),
        Buffer.from(skillId)
      ],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }
  getPurchaseAddress(skillListing, buyer = this.authority) {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("purchase"),
        toPublicKey(buyer).toBuffer(),
        toPublicKey(skillListing).toBuffer()
      ],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }
  getVouchAddress(vouchee) {
    const voucherProfile = this.getAgentProfileAddress(this.authority);
    const voucheeProfile = this.getAgentProfileAddress(vouchee);
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucherProfile.toBuffer(),
        voucheeProfile.toBuffer()
      ],
      new PublicKey(AGENTVOUCH_PROGRAM_ID)
    )[0];
  }
  async accountExists(address) {
    return await this.connection.getAccountInfo(address) !== null;
  }
  async registerAgent(metadataUri) {
    const agentProfile = this.getAgentProfileAddress(this.authority);
    if (await this.accountExists(agentProfile)) {
      return {
        tx: null,
        alreadyRegistered: true,
        agentProfile: agentProfile.toBase58()
      };
    }
    const tx = await this.program.methods.registerAgent(metadataUri).accounts({
      agentProfile,
      authority: this.authority,
      systemProgram: SystemProgram.programId
    }).signers([this.keypair]).rpc();
    return {
      tx,
      alreadyRegistered: false,
      agentProfile: agentProfile.toBase58()
    };
  }
  async vouch(vouchee, amountSol) {
    const voucherProfile = this.getAgentProfileAddress(this.authority);
    const voucheeProfile = this.getAgentProfileAddress(vouchee);
    const vouch2 = this.getVouchAddress(vouchee);
    const config = this.getConfigAddress();
    if (await this.accountExists(vouch2)) {
      return {
        tx: null,
        alreadyExists: true,
        vouch: vouch2.toBase58()
      };
    }
    const lamports = toStakeLamports(amountSol);
    const tx = await this.program.methods.vouch(toLamportsBn(lamports, "stakeLamports")).accounts({
      vouch: vouch2,
      voucherProfile,
      voucheeProfile,
      config,
      voucher: this.authority,
      systemProgram: SystemProgram.programId
    }).signers([this.keypair]).rpc();
    return {
      tx,
      alreadyExists: false,
      vouch: vouch2.toBase58(),
      lamports: Number(lamports)
    };
  }
  async purchaseSkill(skillListingAddress, authorAddress) {
    const purchase = this.getPurchaseAddress(skillListingAddress);
    if (await this.accountExists(purchase)) {
      return {
        tx: null,
        alreadyPurchased: true,
        purchase: purchase.toBase58()
      };
    }
    const authorProfile = this.getAgentProfileAddress(authorAddress);
    const tx = await this.program.methods.purchaseSkill().accounts({
      skillListing: new PublicKey(skillListingAddress),
      purchase,
      author: new PublicKey(authorAddress),
      authorProfile,
      buyer: this.authority,
      systemProgram: SystemProgram.programId
    }).signers([this.keypair]).rpc();
    return {
      tx,
      alreadyPurchased: false,
      purchase: purchase.toBase58()
    };
  }
  async createSkillListing(input) {
    const priceLamports = toLamportsBigInt(input.priceLamports, "priceLamports");
    assertSupportedListingPrice(priceLamports);
    const skillListing = this.getSkillListingAddress(input.skillId);
    if (await this.accountExists(skillListing)) {
      return {
        tx: null,
        alreadyExists: true,
        skillListing: skillListing.toBase58()
      };
    }
    const authorProfile = this.getAgentProfileAddress(this.authority);
    const config = this.getConfigAddress();
    const authorBond = priceLamports === 0n ? this.getAuthorBondAddress(this.authority) : null;
    const tx = await this.program.methods.createSkillListing(
      input.skillId,
      input.skillUri,
      input.name,
      input.description,
      toLamportsBn(priceLamports, "priceLamports")
    ).accounts({
      skillListing,
      authorProfile,
      config,
      authorBond,
      author: this.authority,
      systemProgram: SystemProgram.programId
    }).signers([this.keypair]).rpc();
    return {
      tx,
      alreadyExists: false,
      skillListing: skillListing.toBase58()
    };
  }
};

// src/lib/install.ts
async function resolveChainSkillContent(skill2, api) {
  if ((skill2.price_lamports ?? 0) > 0) {
    throw new CliError(
      `Skill ${skill2.id} is chain-only and paid. Use the repo-backed skill id for signed raw downloads.`
    );
  }
  if (skill2.content) {
    return skill2.content;
  }
  if (skill2.skill_uri?.startsWith("http://") || skill2.skill_uri?.startsWith("https://")) {
    return api.fetchRemoteText(skill2.skill_uri);
  }
  throw new CliError(
    `Skill ${skill2.id} does not expose downloadable content through the API.`
  );
}
async function installSkill(input) {
  const api = new AgentVouchApiClient(input.baseUrl);
  const skill2 = await api.getSkill(input.id);
  const outputPath = path2.resolve(input.out);
  if (!input.dryRun) {
    await assertWritableOutputPath(outputPath, input.force);
  }
  const isChainOnly = skill2.source === "chain" || input.id.startsWith("chain-") || !skill2.id;
  if (isChainOnly) {
    const content = await resolveChainSkillContent(skill2, api);
    if (!input.dryRun) {
      await writeUtf8File(outputPath, content);
    }
    return {
      ok: true,
      mode: "chain-direct",
      skillId: input.id,
      outputPath,
      priceLamports: skill2.price_lamports ?? 0,
      dryRun: !!input.dryRun
    };
  }
  const initialDownload = await api.downloadRaw(input.id);
  if (initialDownload.ok && initialDownload.content !== void 0) {
    if (!input.dryRun) {
      await writeUtf8File(outputPath, initialDownload.content);
    }
    return {
      ok: true,
      mode: "free-raw",
      skillId: input.id,
      outputPath,
      priceLamports: skill2.price_lamports ?? 0,
      dryRun: !!input.dryRun
    };
  }
  if (initialDownload.status !== 402 || !initialDownload.requirement) {
    throw new CliError(
      `Failed to download skill ${input.id}: ${initialDownload.error || "unexpected response"}`
    );
  }
  if (input.dryRun) {
    return {
      ok: true,
      mode: "paid-raw-dry-run",
      skillId: input.id,
      outputPath,
      priceLamports: initialDownload.requirement.amount,
      listingAddress: initialDownload.requirement.skillListingAddress,
      requirement: initialDownload.requirement,
      dryRun: true
    };
  }
  if (!input.keypairPath) {
    throw new CliError(
      "Paid installs require --keypair so the CLI can purchase on-chain and sign the canonical X-AgentVouch-Auth payload."
    );
  }
  if (!skill2.on_chain_address) {
    throw new CliError(
      `Skill ${input.id} returned a payment requirement but has no linked on-chain listing.`
    );
  }
  const keypair = loadKeypair(input.keypairPath);
  const solana = new AgentVouchSolanaClient(keypair, input.rpcUrl);
  const purchase = await solana.purchaseSkill(
    initialDownload.requirement.skillListingAddress,
    skill2.author_pubkey
  );
  const auth = createDownloadAuthPayload(
    keypair,
    input.id,
    initialDownload.requirement.skillListingAddress
  );
  const signedDownload = await api.downloadRaw(input.id, auth);
  if (!signedDownload.ok || signedDownload.content === void 0) {
    throw new CliError(
      `Purchase completed but signed raw download failed: ${signedDownload.error || "unexpected response"}`
    );
  }
  await writeUtf8File(outputPath, signedDownload.content);
  return {
    ok: true,
    mode: "paid-raw",
    skillId: input.id,
    outputPath,
    priceLamports: initialDownload.requirement.amount,
    listingAddress: initialDownload.requirement.skillListingAddress,
    purchaseTx: purchase.tx,
    alreadyPurchased: purchase.alreadyPurchased,
    dryRun: false
  };
}

// src/lib/output.ts
function printLines(value) {
  for (const line of Array.isArray(value) ? value : [value]) {
    console.log(line);
  }
}
async function runCommand(options, action, renderText) {
  try {
    const result = await action();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    printLines(renderText(result));
  } catch (error) {
    const exitCode = error instanceof CliError ? error.exitCode : 1;
    const message = getErrorMessage(error);
    if (options.json) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: message,
            ...error instanceof CliError && error.data !== void 0 ? { data: error.data } : {}
          },
          null,
          2
        )
      );
    } else {
      console.error(`Error: ${message}`);
    }
    process.exitCode = exitCode;
  }
}

// src/lib/publish.ts
import path3 from "path";
async function publishSkill(input) {
  const content = await readUtf8File(path3.resolve(input.file));
  const keypair = loadKeypair(input.keypairPath);
  const repoAuth = createRepoAuthPayload(keypair, "publish-skill");
  const solana = new AgentVouchSolanaClient(keypair, input.rpcUrl);
  const listingAddress = solana.getSkillListingAddress(input.skillId).toBase58();
  if (input.dryRun) {
    return {
      ok: true,
      mode: "dry-run",
      repoRequest: {
        skill_id: input.skillId,
        name: input.name,
        description: input.description,
        tags: input.tags,
        contact: input.contact
      },
      onChainListing: {
        address: listingAddress,
        priceLamports: input.priceLamports
      }
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
    content
  });
  const skillUri = `${input.baseUrl}/api/skills/${repoSkill.id}/raw`;
  const chainListing = await solana.createSkillListing({
    skillId: input.skillId,
    skillUri,
    name: input.name,
    description: input.description,
    priceLamports: input.priceLamports
  });
  const linkAuth = createRepoAuthPayload(keypair, "publish-skill");
  await api.linkSkillListing(repoSkill.id, {
    auth: linkAuth,
    on_chain_address: listingAddress
  });
  return {
    ok: true,
    repoSkillId: repoSkill.id,
    skillId: input.skillId,
    skillUri,
    listingAddress,
    repoIpfsCid: repoSkill.ipfs_cid,
    createListingTx: chainListing.tx,
    listingAlreadyExisted: chainListing.alreadyExists
  };
}
async function addSkillVersion(input) {
  const api = new AgentVouchApiClient(input.baseUrl);
  const keypair = loadKeypair(input.keypairPath);
  const auth = createRepoAuthPayload(keypair, "publish-skill");
  const content = await readUtf8File(path3.resolve(input.file));
  const result = await api.addSkillVersion(input.id, {
    auth,
    content,
    changelog: input.changelog
  });
  return {
    ok: true,
    skillId: input.id,
    version: result.version
  };
}

// src/cli.ts
var MIN_SKILL_PRICE_LAMPORTS2 = 1e6;
function parseLamports(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Expected a non-negative integer lamport amount.");
  }
  if (parsed !== 0 && parsed < MIN_SKILL_PRICE_LAMPORTS2) {
    throw new Error(
      `Expected 0 or at least ${MIN_SKILL_PRICE_LAMPORTS2} lamports.`
    );
  }
  return parsed;
}
function parseAmountSol(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected a positive SOL amount.");
  }
  return parsed;
}
function parsePage(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Expected a positive page number.");
  }
  return parsed;
}
function addBaseUrlOption(command) {
  return command.option(
    "--base-url <url>",
    "AgentVouch API base URL",
    resolveBaseUrl()
  );
}
function addRpcUrlOption(command) {
  return command.option("--rpc-url <url>", "Solana RPC URL", resolveRpcUrl());
}
var program = new Command().name("agentvouch").description("Headless CLI for AgentVouch skill install and publish flows.").version(package_default.version);
var skill = program.command("skill").description("Inspect, list, install, and publish skills.");
addBaseUrlOption(
  skill.command("list").option("--q <query>", "Search by keyword").option("--author <pubkey>", "Filter by author pubkey").option("--tags <csv>", "Filter by comma-separated tags").option(
    "--sort <order>",
    "Sort by newest, trusted, installs, or name",
    "newest"
  ).option("--page <number>", "Results page number", parsePage, 1).option("--json", "Print structured JSON output").addHelpText(
    "after",
    "\nExamples:\n  agentvouch skill list\n  agentvouch skill list --q calendar --sort trusted\n  agentvouch skill list --author asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw --page 2 --json\n\nTrust contract:\n  author_trust_summary is the normalized machine-readable trust summary.\n  author_trust keeps the raw stake and bond fields."
  ).action(
    async (options) => {
      await runCommand(
        options,
        async () => new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).listSkills(
          {
            q: options.q,
            author: options.author,
            tags: options.tags,
            sort: options.sort,
            page: options.page
          }
        ),
        formatSkillList
      );
    }
  )
);
addBaseUrlOption(
  skill.command("inspect").argument("<id>", "Repo UUID or chain-<listing> id").option("--json", "Print structured JSON output").addHelpText(
    "after",
    "\nExamples:\n  agentvouch skill inspect 595f5534-07ae-4839-a45a-b6858ab731fe\n  agentvouch skill inspect chain-Eq35iaSKECtZAGMkPVSk18tqFDFe6L3hgEhJsUzkByFd --json\n\nTrust contract:\n  author_trust_summary matches GET /api/agents/{pubkey}/trust -> trust.\n  author_trust includes raw bond and total stake-at-risk fields."
  ).action(
    async (id, options) => {
      await runCommand(
        options,
        async () => new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).getSkill(
          id
        ),
        formatSkillSummary
      );
    }
  )
);
addRpcUrlOption(
  addBaseUrlOption(
    skill.command("install").argument("<id>", "Repo UUID or chain-<listing> id").requiredOption(
      "--out <path>",
      "Output path for the downloaded skill file",
      "SKILL.md"
    ).option("--keypair <file>", "Solana keypair JSON file for paid installs").option("--force", "Overwrite an existing output file").option(
      "--dry-run",
      "Show the required paid flow without purchasing or writing"
    ).option("--json", "Print structured JSON output").addHelpText(
      "after",
      "\nExamples:\n  agentvouch skill install 595f5534-07ae-4839-a45a-b6858ab731fe --out ./SKILL.md\n  agentvouch skill install 595f5534-07ae-4839-a45a-b6858ab731fe --out ./SKILL.md --keypair ~/.config/solana/id.json\n  agentvouch skill install 595f5534-07ae-4839-a45a-b6858ab731fe --out ./SKILL.md --dry-run --json"
    ).action(
      async (id, options) => {
        await runCommand(
          options,
          async () => installSkill({
            id,
            out: options.out,
            keypairPath: options.keypair,
            force: options.force,
            dryRun: options.dryRun,
            baseUrl: resolveBaseUrl(options.baseUrl),
            rpcUrl: resolveRpcUrl(options.rpcUrl)
          }),
          (result) => [
            `installed ${result.skillId}`,
            `mode: ${result.mode}`,
            `output: ${result.outputPath}`,
            `price_lamports: ${result.priceLamports}`,
            ...result.listingAddress ? [`listing: ${result.listingAddress}`] : [],
            ...result.purchaseTx ? [`purchase_tx: ${result.purchaseTx}`] : [],
            ...result.dryRun ? ["dry_run: true"] : []
          ]
        );
      }
    )
  )
);
addRpcUrlOption(
  addBaseUrlOption(
    skill.command("publish").requiredOption("--file <path>", "Path to the local SKILL.md file").requiredOption("--skill-id <id>", "Stable on-chain skill id/slug").requiredOption("--name <name>", "Skill display name").requiredOption("--description <text>", "Skill description").requiredOption("--keypair <file>", "Solana keypair JSON file").option("--contact <text>", "Optional author contact info").option("--tags <csv>", "Comma-separated tags", "").option(
      "--price-lamports <lamports>",
      "Listing price in lamports",
      parseLamports,
      1e6
    ).option(
      "--dry-run",
      "Preview the repo and on-chain requests without sending them"
    ).option("--json", "Print structured JSON output").addHelpText(
      "after",
      '\nExamples:\n  agentvouch skill publish --file ./SKILL.md --skill-id calendar-agent --name "Calendar Agent" --description "Books and manages calendar tasks" --keypair ~/.config/solana/id.json\n  agentvouch skill publish --file ./SKILL.md --skill-id calendar-agent --name "Calendar Agent" --description "Books and manages calendar tasks" --price-lamports 0 --keypair ~/.config/solana/id.json --dry-run'
    ).action(
      async (options) => {
        await runCommand(
          options,
          async () => publishSkill({
            file: options.file,
            skillId: options.skillId,
            name: options.name,
            description: options.description,
            keypairPath: options.keypair,
            contact: options.contact,
            tags: options.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            priceLamports: options.priceLamports,
            dryRun: options.dryRun,
            baseUrl: resolveBaseUrl(options.baseUrl),
            rpcUrl: resolveRpcUrl(options.rpcUrl)
          }),
          (result) => [
            `published ${result.skillId}`,
            ...result.mode === "dry-run" ? [
              `repo_skill_id: ${result.repoRequest.skill_id}`,
              `listing: ${result.onChainListing.address}`,
              `price_lamports: ${result.onChainListing.priceLamports}`,
              "dry_run: true"
            ] : [
              `repo_id: ${result.repoSkillId}`,
              `listing: ${result.listingAddress}`,
              `skill_uri: ${result.skillUri}`,
              `price_ipfs_cid: ${result.repoIpfsCid ?? "none"}`,
              ...result.createListingTx ? [`create_listing_tx: ${result.createListingTx}`] : []
            ]
          ]
        );
      }
    )
  )
);
var skillVersion = skill.command("version").description("Manage repo skill versions.");
addBaseUrlOption(
  skillVersion.command("add").argument("<id>", "Repo skill UUID").requiredOption("--file <path>", "Path to the local SKILL.md file").requiredOption("--keypair <file>", "Solana keypair JSON file").option("--changelog <text>", "Optional changelog entry").option("--json", "Print structured JSON output").addHelpText(
    "after",
    '\nExamples:\n  agentvouch skill version add 595f5534-07ae-4839-a45a-b6858ab731fe --file ./SKILL.md --changelog "Fix env var names" --keypair ~/.config/solana/id.json'
  ).action(
    async (id, options) => {
      await runCommand(
        options,
        async () => addSkillVersion({
          id,
          file: options.file,
          keypairPath: options.keypair,
          changelog: options.changelog,
          baseUrl: resolveBaseUrl(options.baseUrl)
        }),
        (result) => [
          `added version for ${result.skillId}`,
          `version: ${result.version}`
        ]
      );
    }
  )
);
var author = program.command("author").description("Manage author profile actions.");
addBaseUrlOption(
  author.command("list").option(
    "--trusted",
    "Only return authors whose recommended action is allow"
  ).option("--json", "Print structured JSON output").addHelpText(
    "after",
    "\nExamples:\n  agentvouch author list\n  agentvouch author list --trusted\n  agentvouch author list --json"
  ).action(
    async (options) => {
      await runCommand(
        options,
        async () => new AgentVouchApiClient(resolveBaseUrl(options.baseUrl)).listAuthors(
          {
            trusted: options.trusted
          }
        ),
        formatAuthorList
      );
    }
  )
);
addRpcUrlOption(
  author.command("register").requiredOption("--keypair <file>", "Solana keypair JSON file").option("--metadata-uri <uri>", "Metadata URI for the agent profile", "").option("--json", "Print structured JSON output").addHelpText(
    "after",
    "\nExamples:\n  agentvouch author register --keypair ~/.config/solana/id.json --metadata-uri https://example.com/agent.json"
  ).action(
    async (options) => {
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
          ...result.tx ? [`tx: ${result.tx}`] : []
        ]
      );
    }
  )
);
var vouch = program.command("vouch").description("Create stake-backed vouches.");
addRpcUrlOption(
  vouch.command("create").requiredOption("--author <pubkey>", "Author wallet pubkey to vouch for").requiredOption(
    "--amount-sol <amount>",
    "SOL amount to stake",
    parseAmountSol
  ).requiredOption("--keypair <file>", "Solana keypair JSON file").option("--json", "Print structured JSON output").addHelpText(
    "after",
    "\nExamples:\n  agentvouch vouch create --author asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw --amount-sol 0.1 --keypair ~/.config/solana/id.json"
  ).action(
    async (options) => {
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
          ...result.lamports ? [`lamports: ${result.lamports}`] : [],
          ...result.tx ? [`tx: ${result.tx}`] : []
        ]
      );
    }
  )
);
await program.parseAsync(process.argv);
//# sourceMappingURL=cli.js.map