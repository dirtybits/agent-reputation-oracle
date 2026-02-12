# AgentSkills.io Format Reference

Source: https://agentskills.io/what-are-skills (Read: 2026-02-12)

## What is a Skill?

A skill is a folder containing a `SKILL.md` file (uppercase, not skill.md). This file includes:
- YAML frontmatter (name and description, at minimum)
- Markdown instructions telling an agent how to perform a specific task
- Optional bundled scripts, templates, and reference materials

## Folder Structure

```
my-skill/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
└── assets/           # Optional: templates, resources
```

## How Skills Work (Progressive Disclosure)

1. **Discovery:** At startup, agents load only the name and description of each available skill
2. **Activation:** When a task matches a skill's description, the agent reads the full SKILL.md into context
3. **Execution:** The agent follows instructions, loading referenced files or executing bundled code as needed

This keeps agents fast while giving them access to more context on demand.

## SKILL.md Format

Every skill starts with YAML frontmatter followed by Markdown instructions:

```markdown
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
---

# PDF Processing

## When to use this skill
Use this skill when the user needs to work with PDF files...

## How to extract text
1. Use pdfplumber for text extraction...

## How to fill forms
...
```

### Required Frontmatter

- **name:** A short identifier (kebab-case recommended)
- **description:** When to use this skill (this is what agents see during discovery)

### Markdown Body

The Markdown body contains the actual instructions and has **no specific restrictions** on structure or content.

## Key Advantages

1. **Self-documenting:** Anyone can read a SKILL.md and understand what it does
2. **Extensible:** Skills can range from simple text instructions to complex code + assets
3. **Portable:** Skills are just files - easy to edit, version, and share

## Resources

- [Full Specification](https://agentskills.io/specification)
- [Integration Guide](https://agentskills.io/integrate-skills) - for building compatible agents
- [Example Skills](https://github.com/anthropics/skills)
- [Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Reference Library](https://github.com/agentskills/agentskills/tree/main/skills-ref) - for validation and prompt XML generation

## Key Takeaways

- File MUST be named `SKILL.md` (uppercase)
- Frontmatter MUST include `name` and `description`
- Description should clearly state "when to use this skill"
- Body can be any valid Markdown
- Skills are discovered by description, activated by full read
