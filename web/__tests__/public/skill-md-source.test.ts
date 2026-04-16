import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("public skill.md", () => {
  const md = fs.readFileSync(
    path.join(process.cwd(), "public/skill.md"),
    "utf8"
  );

  it("uses agent vocabulary for the register command", () => {
    expect(md).toContain("agentvouch agent register");
    expect(md).not.toMatch(/agentvouch author register/);
  });

  it("describes vouching against agents, not authors", () => {
    expect(md).toContain("Vouch for another agent");
  });
});
