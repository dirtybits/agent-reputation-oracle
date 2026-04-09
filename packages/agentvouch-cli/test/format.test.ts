import { describe, expect, it } from "vitest";
import { formatSkillSummary } from "../src/lib/format.js";
import type { SkillRecord } from "../src/lib/http.js";

function buildSkill(overrides: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id: "595f5534-07ae-4839-a45a-b6858ab731fe",
    skill_id: "calendar-agent",
    author_pubkey: "asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw",
    name: "Calendar Agent",
    description: "Books meetings",
    on_chain_address: "Eq35iaSKECtZAGMkPVSk18tqFDFe6L3hgEhJsUzkByFd",
    price_lamports: 1_000_000,
    total_installs: 4,
    source: "repo",
    ...overrides,
  };
}

describe("formatSkillSummary", () => {
  it("prefers the normalized trust summary when present", () => {
    const lines = formatSkillSummary(
      buildSkill({
        author_trust: {
          isRegistered: true,
          activeDisputesAgainstAuthor: 9,
          disputesUpheldAgainstAuthor: 9,
        },
        author_trust_summary: {
          wallet_pubkey: "asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw",
          canonical_agent_id: "solana:devnet/asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw",
          chain_context: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
          schema_version: "2026-04-03",
          trust_updated_at: "2026-04-09T00:00:00.000Z",
          recommended_action: "review",
          reputationScore: 10,
          totalVouchesReceived: 2,
          totalStakedFor: 1000,
          disputesAgainstAuthor: 1,
          disputesUpheldAgainstAuthor: 1,
          activeDisputesAgainstAuthor: 2,
          registeredAt: 123,
          isRegistered: true,
        },
      })
    );

    expect(lines).toContain("registered: yes");
    expect(lines).toContain("recommended_action: review");
    expect(lines).toContain("active_author_disputes: 2");
    expect(lines).toContain("upheld_author_disputes: 1");
  });

  it("falls back to raw author trust when the normalized summary is absent", () => {
    const lines = formatSkillSummary(
      buildSkill({
        author_trust: {
          isRegistered: false,
          activeDisputesAgainstAuthor: 3,
          disputesUpheldAgainstAuthor: 4,
        },
        author_trust_summary: null,
      })
    );

    expect(lines).toContain("registered: no");
    expect(lines).not.toContain("recommended_action: review");
    expect(lines).toContain("active_author_disputes: 3");
    expect(lines).toContain("upheld_author_disputes: 4");
  });
});
