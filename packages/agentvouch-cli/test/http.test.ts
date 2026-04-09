import { afterEach, describe, expect, it, vi } from "vitest";
import { CliError } from "../src/lib/errors.js";
import { AgentVouchApiClient } from "../src/lib/http.js";

describe("AgentVouchApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists skills with API-aligned query params", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          skills: [
            {
              id: "595f5534-07ae-4839-a45a-b6858ab731fe",
              skill_id: "calendar-agent",
              author_pubkey: "asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw",
              name: "Calendar Agent",
              description: "Books meetings",
              tags: ["calendar", "ops"],
              on_chain_address: null,
              price_lamports: 0,
              total_installs: 4,
              source: "repo",
            },
          ],
          pagination: {
            page: 2,
            pageSize: 20,
            total: 25,
            totalPages: 2,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    const client = new AgentVouchApiClient("https://agentvouch.xyz");

    const result = await client.listSkills({
      q: "calendar",
      sort: "trusted",
      author: "asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw",
      tags: "calendar,ops",
      page: 2,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://agentvouch.xyz/api/skills?q=calendar&sort=trusted&author=asuavUDGmrVHr4oD1b4QtnnXgtnEcBa8qdkfZz7WZgw&tags=calendar%2Cops&page=2"
    );
    expect(result.pagination.totalPages).toBe(2);
    expect(result.skills[0]?.skill_id).toBe("calendar-agent");
  });

  it("surfaces list errors as CliError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "upstream failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = new AgentVouchApiClient("https://agentvouch.xyz");

    try {
      await client.listSkills();
      throw new Error("Expected listSkills to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect(error).toHaveProperty(
        "message",
        "Failed to list skills: upstream failed"
      );
    }
  });
});
