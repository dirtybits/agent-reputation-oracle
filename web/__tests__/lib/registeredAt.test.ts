import { describe, expect, it } from "vitest";
import { normalizeRegisteredAt } from "@/lib/registeredAt";

describe("normalizeRegisteredAt", () => {
  it("keeps plausible unix timestamps", () => {
    expect(normalizeRegisteredAt(1_775_347_200, 1_800_000_000)).toBe(
      1_775_347_200
    );
  });

  it("drops tiny legacy-corrupted timestamps", () => {
    expect(normalizeRegisteredAt(254, 1_800_000_000)).toBe(0);
  });

  it("drops implausible future timestamps", () => {
    expect(normalizeRegisteredAt(9_999_999_999, 1_800_000_000)).toBe(0);
  });
});
