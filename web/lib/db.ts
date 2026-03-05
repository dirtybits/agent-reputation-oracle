import { neon } from '@neondatabase/serverless';

let _sql: ReturnType<typeof neon> | null = null;

export function sql(): (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required. Set it in web/.env.local');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql as any;
}

export async function initializeDatabase() {
  const db = sql();

  await db`
    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      skill_id VARCHAR(64) NOT NULL,
      author_pubkey VARCHAR(44) NOT NULL,
      name VARCHAR(64) NOT NULL,
      description VARCHAR(256),
      tags TEXT[] DEFAULT '{}',
      current_version INTEGER DEFAULT 1,
      ipfs_cid VARCHAR(128),
      on_chain_address VARCHAR(44),
      chain_context VARCHAR(16) DEFAULT 'solana',
      total_installs INTEGER DEFAULT 0,
      contact VARCHAR(128),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(author_pubkey, skill_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS skill_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      ipfs_cid VARCHAR(128),
      changelog TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(skill_id, version)
    )
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_skills_search ON skills
    USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')))
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_skills_author ON skills(author_pubkey)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_skills_tags ON skills USING GIN(tags)
  `;

  await db`
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_pubkey VARCHAR(44) NOT NULL,
      key_hash VARCHAR(128) NOT NULL,
      key_prefix VARCHAR(12) NOT NULL,
      name VARCHAR(64) NOT NULL DEFAULT 'default',
      permissions TEXT[] DEFAULT '{skills:read,skills:install}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    )
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_pubkey)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)
  `;
}
