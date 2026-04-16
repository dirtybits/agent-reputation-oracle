import type { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildProgram, parseAmountSol } from "../src/cli.js";
import { formatCreateVouchResult } from "../src/lib/format.js";

function captureHelp(command: Command): string {
  let captured = "";
  command.configureOutput({
    writeOut: (s) => {
      captured += s;
    },
    writeErr: () => {},
    outputError: () => {},
  });
  command.outputHelp();
  return captured;
}

describe("vouch command tree", () => {
  const program = buildProgram();
  const vouch = program.commands.find((c) => c.name() === "vouch");

  it("registers a top-level vouch command with a create subcommand", () => {
    expect(vouch).toBeDefined();
    const subs = vouch!.commands.map((c) => c.name());
    expect(subs).toEqual(expect.arrayContaining(["create"]));
  });

  it("surfaces the required options and example in vouch create --help", () => {
    const create = vouch!.commands.find((c) => c.name() === "create")!;
    const help = captureHelp(create);
    expect(help).toContain("--author");
    expect(help).toContain("--amount-sol");
    expect(help).toContain("--keypair");
    expect(help).toContain("agentvouch vouch create --author");
  });
});

describe("parseAmountSol", () => {
  it("accepts positive amounts", () => {
    expect(parseAmountSol("0.1")).toBe(0.1);
    expect(parseAmountSol("1")).toBe(1);
    expect(parseAmountSol("3.5")).toBe(3.5);
  });

  it("rejects zero, negatives, and non-numeric input", () => {
    expect(() => parseAmountSol("0")).toThrow(/positive SOL amount/);
    expect(() => parseAmountSol("-1")).toThrow(/positive SOL amount/);
    expect(() => parseAmountSol("not-a-number")).toThrow(
      /positive SOL amount/
    );
  });
});

describe("formatCreateVouchResult", () => {
  it("omits lamports and tx when the vouch already exists", () => {
    const lines = formatCreateVouchResult({
      vouch: "PDAvouch",
      alreadyExists: true,
    });

    expect(lines).toContain("vouch: PDAvouch");
    expect(lines).toContain("already_exists: yes");
    expect(lines.some((l) => l.startsWith("lamports:"))).toBe(false);
    expect(lines.some((l) => l.startsWith("tx:"))).toBe(false);
  });

  it("emits lamports and tx on a fresh vouch", () => {
    const lines = formatCreateVouchResult({
      vouch: "PDAvouch",
      alreadyExists: false,
      lamports: 100_000_000,
      tx: "txsig",
    });

    expect(lines).toContain("already_exists: no");
    expect(lines).toContain("lamports: 100000000");
    expect(lines).toContain("tx: txsig");
  });
});
