import { describe, expect, it } from "vitest";

import {
  MAX_SKILL_DESCRIPTION_LENGTH,
  deriveDraftMetadataFromContent,
  normalizeSkillDescription,
  parseFrontmatter,
  slugify,
} from "@/lib/skillDraft";

describe("skillDraft helpers", () => {
  it("parses the full H1 title and description", () => {
    const parsed = parseFrontmatter(
      "# Lorem Ipsem\n\nLorem ipsum is placeholder text.\n\n## More"
    );

    expect(parsed.name).toBe("Lorem Ipsem");
    expect(parsed.description).toBe("Lorem ipsum is placeholder text.");
  });

  it("keeps autofilled metadata in sync while content changes", () => {
    const draft = deriveDraftMetadataFromContent({
      content:
        "# Lorem Ipsem\n\nLorem ipsum is placeholder text commonly used in publishing.",
      currentName: "L",
      currentSkillId: "l",
      currentDescription: "",
      nameManuallyEdited: false,
      skillIdManuallyEdited: false,
      descriptionManuallyEdited: false,
    });

    expect(draft.name).toBe("Lorem Ipsem");
    expect(draft.skillId).toBe(slugify("Lorem Ipsem"));
    expect(draft.description).toBe(
      "Lorem ipsum is placeholder text commonly used in publishing."
    );
  });

  it("truncates auto-derived descriptions to the database limit", () => {
    const longDescription = "a".repeat(MAX_SKILL_DESCRIPTION_LENGTH + 50);
    const draft = deriveDraftMetadataFromContent({
      content: `# Generated Name\n\n${longDescription}`,
      currentName: "",
      currentSkillId: "",
      currentDescription: "",
      nameManuallyEdited: false,
      skillIdManuallyEdited: false,
      descriptionManuallyEdited: false,
    });

    expect(draft.description).toBe(
      normalizeSkillDescription(longDescription)
    );
    expect(draft.description.length).toBe(MAX_SKILL_DESCRIPTION_LENGTH);
  });

  it("preserves manually edited metadata", () => {
    const draft = deriveDraftMetadataFromContent({
      content: "# Generated Name\n\nGenerated description",
      currentName: "Custom Name",
      currentSkillId: "custom-skill-id",
      currentDescription: "Custom description",
      nameManuallyEdited: true,
      skillIdManuallyEdited: true,
      descriptionManuallyEdited: true,
    });

    expect(draft.name).toBe("Custom Name");
    expect(draft.skillId).toBe("custom-skill-id");
    expect(draft.description).toBe("Custom description");
  });
});
