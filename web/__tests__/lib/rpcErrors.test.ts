import { describe, expect, it } from "vitest";

import { isRpcRateLimitError, wrapRpcLookupError } from "@/lib/rpcErrors";

describe("rpcErrors", () => {
  it("detects common RPC rate limit messages", () => {
    expect(isRpcRateLimitError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isRpcRateLimitError(new Error("rate limit exceeded"))).toBe(true);
    expect(isRpcRateLimitError("Too many requests from this IP")).toBe(true);
    expect(isRpcRateLimitError(new Error("socket hang up"))).toBe(false);
  });

  it("wraps lookup errors with context", () => {
    expect(
      wrapRpcLookupError(new Error("429 Too Many Requests"), "lookup failed")
        .message
    ).toContain("lookup failed: 429 Too Many Requests");
  });
});
