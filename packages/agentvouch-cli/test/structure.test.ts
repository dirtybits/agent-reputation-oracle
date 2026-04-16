import type { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildProgram } from "../src/cli.js";

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

describe("CLI command structure", () => {
  const program = buildProgram();

  it("exposes agent as primary and author as deprecated alias", () => {
    const names = program.commands.map((c) => c.name());
    expect(names).toEqual(
      expect.arrayContaining(["skill", "skills", "agent", "author", "vouch"])
    );
    const author = program.commands.find((c) => c.name() === "author")!;
    expect(author.description()).toMatch(/deprecated/i);

    const agent = program.commands.find((c) => c.name() === "agent")!;
    expect(agent.description()).not.toMatch(/deprecated/i);
  });

  it("registers list, register, and trust on both agent and author", () => {
    for (const groupName of ["agent", "author"] as const) {
      const group = program.commands.find((c) => c.name() === groupName)!;
      const subs = group.commands.map((c) => c.name());
      expect(subs).toEqual(
        expect.arrayContaining(["list", "register", "trust"])
      );
    }
  });

  it("marks only the author variant help as deprecated", () => {
    const author = program.commands.find((c) => c.name() === "author")!;
    const agent = program.commands.find((c) => c.name() === "agent")!;

    for (const sub of ["list", "register", "trust"] as const) {
      const authorSub = author.commands.find((c) => c.name() === sub)!;
      const agentSub = agent.commands.find((c) => c.name() === sub)!;
      expect(captureHelp(authorSub)).toContain(
        `Deprecated alias: use \`agent ${sub}\``
      );
      expect(captureHelp(agentSub)).not.toMatch(/Deprecated alias/);
    }
  });
});
