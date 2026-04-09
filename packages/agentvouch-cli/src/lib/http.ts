import type { AuthPayload, PaymentRequirement } from "@agentvouch/protocol";
import { CliError } from "./errors.js";

export interface SkillAuthorTrust {
  isRegistered?: boolean;
  reputationScore?: number;
  totalVouchesReceived?: number;
  totalStakedFor?: number;
  disputesAgainstAuthor?: number;
  disputesUpheldAgainstAuthor?: number;
  activeDisputesAgainstAuthor?: number;
  authorBondLamports?: number;
  totalStakeAtRisk?: number;
  registeredAt?: number;
}

export interface SkillAuthorTrustSummary {
  wallet_pubkey: string;
  canonical_agent_id: string;
  chain_context: string;
  schema_version: string;
  trust_updated_at: string;
  recommended_action: "allow" | "review" | "avoid";
  reputationScore: number;
  totalVouchesReceived: number;
  totalStakedFor: number;
  disputesAgainstAuthor: number;
  disputesUpheldAgainstAuthor: number;
  activeDisputesAgainstAuthor: number;
  registeredAt: number;
  isRegistered: boolean;
}

export interface SkillRecord {
  id: string;
  skill_id: string;
  author_pubkey: string;
  name: string;
  description: string | null;
  tags?: string[];
  chain_context?: string | null;
  on_chain_address: string | null;
  price_lamports?: number | null;
  total_installs: number;
  total_downloads?: number | null;
  total_revenue?: number | null;
  skill_uri?: string | null;
  source?: "repo" | "chain";
  content?: string | null;
  buyerHasPurchased?: boolean;
  author_trust?: SkillAuthorTrust | null;
  author_trust_summary?: SkillAuthorTrustSummary | null;
  author_identity?: {
    name?: string | null;
  } | null;
}

export interface SkillListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SkillListResponse {
  skills: SkillRecord[];
  pagination: SkillListPagination;
}

export interface ListSkillsOptions {
  q?: string;
  sort?: "newest" | "trusted" | "installs" | "name";
  author?: string;
  tags?: string;
  page?: number;
}

export interface PublishedSkillRecord {
  id: string;
  skill_id: string;
  ipfs_cid: string | null;
}

export interface DownloadResponse {
  ok: boolean;
  status: number;
  content?: string;
  error?: string;
  requirement?: PaymentRequirement;
}

function getJsonContentType(response: Response): boolean {
  return (response.headers.get("content-type") || "").includes(
    "application/json"
  );
}

function parsePaymentRequirement(response: Response, body?: unknown) {
  const header = response.headers.get("x-payment");
  if (header) {
    try {
      return JSON.parse(header) as PaymentRequirement;
    } catch {
      return undefined;
    }
  }

  if (
    body &&
    typeof body === "object" &&
    "requirement" in body &&
    body.requirement
  ) {
    return body.requirement as PaymentRequirement;
  }

  return undefined;
}

export class AgentVouchApiClient {
  constructor(private readonly baseUrl: string) {}

  url(pathname: string): string {
    return `${this.baseUrl}${pathname}`;
  }

  async listSkills(
    options: ListSkillsOptions = {}
  ): Promise<SkillListResponse> {
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
    if (options.page !== undefined) {
      searchParams.set("page", String(options.page));
    }

    const query = searchParams.toString();
    const response = await fetch(
      this.url(`/api/skills${query ? `?${query}` : ""}`)
    );
    const body = (await response.json().catch(() => null)) as
      | SkillListResponse
      | { error?: string }
      | null;

    if (
      !response.ok ||
      !body ||
      "error" in body ||
      !Array.isArray(body.skills) ||
      !body.pagination
    ) {
      throw new CliError(
        `Failed to list skills: ${body?.error || response.statusText}`,
        { exitCode: 1, data: body }
      );
    }

    return body;
  }

  async getSkill(id: string): Promise<SkillRecord> {
    const response = await fetch(this.url(`/api/skills/${id}`));
    const body = (await response.json().catch(() => null)) as
      | SkillRecord
      | { error?: string }
      | null;

    if (!response.ok || !body || "error" in body) {
      throw new CliError(
        `Failed to inspect skill ${id}: ${body?.error || response.statusText}`,
        { exitCode: 1, data: body }
      );
    }

    return body;
  }

  async fetchRemoteText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new CliError(
        `Failed to fetch skill content from ${url}: ${response.status} ${response.statusText}`
      );
    }
    return response.text();
  }

  async downloadRaw(id: string, auth?: AuthPayload): Promise<DownloadResponse> {
    const response = await fetch(this.url(`/api/skills/${id}/raw`), {
      headers: auth ? { "X-AgentVouch-Auth": JSON.stringify(auth) } : undefined,
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        content: await response.text(),
      };
    }

    const body = getJsonContentType(response)
      ? ((await response.json().catch(() => null)) as { error?: string } | null)
      : null;

    return {
      ok: false,
      status: response.status,
      error:
        body?.error ||
        (await response.text().catch(() => response.statusText)) ||
        response.statusText,
      requirement: parsePaymentRequirement(response, body),
    };
  }

  async publishSkill(
    body: Record<string, unknown>
  ): Promise<PublishedSkillRecord> {
    const response = await fetch(this.url("/api/skills"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | PublishedSkillRecord
      | { error?: string }
      | null;

    if (!response.ok || !payload || "error" in payload) {
      throw new CliError(
        `Failed to publish repo skill: ${
          payload?.error || response.statusText
        }`,
        { exitCode: 1, data: payload }
      );
    }

    return payload;
  }

  async linkSkillListing(
    skillId: string,
    body: Record<string, unknown>
  ): Promise<SkillRecord> {
    const response = await fetch(this.url(`/api/skills/${skillId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | SkillRecord
      | { error?: string }
      | null;

    if (!response.ok || !payload || "error" in payload) {
      throw new CliError(
        `Failed to link repo skill ${skillId} to on-chain listing: ${
          payload?.error || response.statusText
        }`,
        { exitCode: 1, data: payload }
      );
    }

    return payload;
  }

  async addSkillVersion(
    skillId: string,
    body: Record<string, unknown>
  ): Promise<{ version: number }> {
    const response = await fetch(this.url(`/api/skills/${skillId}/versions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | { version: number; error?: never }
      | { error?: string }
      | null;

    if (!response.ok || !payload || "error" in payload) {
      throw new CliError(
        `Failed to add skill version for ${skillId}: ${
          payload?.error || response.statusText
        }`,
        { exitCode: 1, data: payload }
      );
    }

    return payload;
  }
}
