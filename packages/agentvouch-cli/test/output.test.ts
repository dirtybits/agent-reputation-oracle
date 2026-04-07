import { afterEach, describe, expect, it, vi } from "vitest";
import { CliError } from "../src/lib/errors.js";
import { runCommand } from "../src/lib/output.js";

describe("runCommand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("prints structured json on success", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(
      { json: true },
      async () => ({ ok: true, id: "skill-1" }),
      () => "unused"
    );

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ ok: true, id: "skill-1" }, null, 2)
    );
  });

  it("prints structured json on failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runCommand(
      { json: true },
      async () => {
        throw new CliError("boom", { data: { step: "publish" } });
      },
      () => "unused"
    );

    expect(errorSpy).toHaveBeenCalledWith(
      JSON.stringify(
        { ok: false, error: "boom", data: { step: "publish" } },
        null,
        2
      )
    );
  });
});
