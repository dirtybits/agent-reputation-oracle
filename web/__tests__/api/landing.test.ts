import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();

vi.mock("@solana/kit", () => {
  return {
    createSolanaRpc: () => ({
      getProgramAccounts: () => ({
        send: mockSend,
      }),
    }),
  };
});

vi.mock("@solana/rpc-types", () => ({}));

vi.mock("@/generated/reputation-oracle/src/generated", () => ({
  getSkillListingDecoder: () => ({
    decode: () => ({
      author: "Author1",
      name: "Test Skill",
      description: "A skill",
      priceLamports: 1000000n,
      totalDownloads: 5n,
      totalRevenue: 2000000n,
      status: { active: {} },
    }),
  }),
  SKILL_LISTING_DISCRIMINATOR: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
  getAgentProfileDecoder: () => ({
    decode: () => ({
      authority: "Agent1",
      totalStakedFor: 500000n,
    }),
  }),
  AGENT_PROFILE_DISCRIMINATOR: new Uint8Array([9, 10, 11, 12, 13, 14, 15, 16]),
}));

vi.mock("@/generated/reputation-oracle/src/generated/programs", () => ({
  REPUTATION_ORACLE_PROGRAM_ADDRESS: "FakeProgramAddr",
}));

import { GET } from "@/app/api/landing/route";

describe("GET /api/landing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns metrics and featuredSkills on success (empty)", async () => {
    mockSend.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics).toBeDefined();
    expect(body.metrics.agents).toBe(0);
    expect(body.metrics.skills).toBe(0);
    expect(body.metrics.revenue).toBe(0);
    expect(body.featuredSkills).toEqual([]);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("returns populated metrics with accounts", async () => {
    const fakeAccountData = Buffer.from(new Uint8Array(256)).toString("base64");

    mockSend
      .mockResolvedValueOnce([
        { pubkey: "Skill1", account: { data: [fakeAccountData, "base64"] } },
        { pubkey: "Skill2", account: { data: [fakeAccountData, "base64"] } },
      ])
      .mockResolvedValueOnce([
        { pubkey: "Agent1", account: { data: [fakeAccountData, "base64"] } },
      ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.skills).toBe(2);
    expect(body.metrics.agents).toBe(1);
    expect(body.featuredSkills.length).toBeGreaterThan(0);
  });

  it("returns 500 when RPC fails", async () => {
    mockSend.mockRejectedValue(new Error("RPC timeout"));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("RPC timeout");
  });
});
