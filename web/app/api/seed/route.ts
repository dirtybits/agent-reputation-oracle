import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getConfiguredSolanaChainContext } from "@/lib/chains";
import { getErrorMessage } from "@/lib/errors";

type CountRow = { count: string };
type SkillIdRow = { id: string };

export async function POST() {
  try {
    const chainContext = getConfiguredSolanaChainContext();
    const existingRows = await sql()<CountRow>`
      SELECT COUNT(*) as count FROM skills
    `;

    if (parseInt(existingRows[0]?.count) > 0) {
      return NextResponse.json({
        message: "Seed data already exists",
        skipped: true,
      });
    }

    const skillRows = await sql()<SkillIdRow>`
      INSERT INTO skills (skill_id, author_pubkey, name, description, tags, current_version, chain_context)
      VALUES (
        'solana-dev-skill',
        '11111111111111111111111111111111',
        'Solana Developer Skill',
        'Core Solana development concepts, APIs, and SDK usage for AI agents.',
        ARRAY['solana', 'blockchain', 'development'],
        1,
        ${chainContext}
      )
      RETURNING id
    `;
    const skill = skillRows[0];

    await sql()`
      INSERT INTO skill_versions (skill_id, version, content, changelog)
      VALUES (
        ${skill.id}::uuid,
        1,
        ${SEED_CONTENT},
        'Initial release'
      )
    `;

    return NextResponse.json({ success: true, skill_id: skill.id });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

const SEED_CONTENT = `# Solana Developer Skill

Summarizes Solana core concepts and answers questions using the Solana core docs.

## When to Use

Use when the user asks about:
- Solana core concepts
- Accounts, transactions, fees
- Programs, PDAs, CPI
- Tokens, clusters
- Core documentation

## Key Concepts

### Accounts
Everything on Solana is an account. Accounts store state and are owned by programs.

### Transactions
Instructions grouped into transactions. Each instruction targets a program.

### Programs
On-chain code (smart contracts). Written in Rust, deployed as BPF bytecode.

### PDAs
Program Derived Addresses - deterministic addresses owned by programs, not keypairs.
`;
