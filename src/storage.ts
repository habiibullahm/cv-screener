import { Pool, type PoolConfig } from "pg";

export interface JdTemplate {
  id: string;
  name: string;
  sourceType: "pasted" | "linked_post";
  sourceUrl?: string;
  title?: string;
  jdText: string;
  createdAt: string;
  updatedAt: string;
}

let pool: Pool | undefined;

function getPool(): Pool | undefined {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return undefined;
  if (!pool) {
    const config: PoolConfig = { connectionString, max: 5 };
    if (process.env.DATABASE_SSL !== "false") {
      config.ssl = { rejectUnauthorized: false };
    }
    pool = new Pool(config);
  }
  return pool;
}

export function isStorageConfigured(): boolean {
  return getPool() !== undefined;
}

export async function closeStorage(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}

export async function ensureStorageSchema(): Promise<void> {
  const database = getPool();
  if (!database) return;
  await database.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS cv_screener_users (
      id BIGSERIAL PRIMARY KEY,
      telegram_user_id TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cv_screener_jd_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id BIGINT NOT NULL REFERENCES cv_screener_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
      source_type TEXT NOT NULL CHECK (source_type IN ('pasted', 'linked_post')),
      source_url TEXT,
      title TEXT,
      jd_text TEXT NOT NULL CHECK (char_length(jd_text) BETWEEN 20 AND 20000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cv_screener_jd_templates_user_idx
      ON cv_screener_jd_templates(user_id, updated_at DESC);
  `);
}

async function ensureUser(telegramUserId: string): Promise<number> {
  const database = getPool();
  if (!database) throw new Error("Storage is not configured");
  const result = await database.query<{ id: number }>(
    `INSERT INTO cv_screener_users (telegram_user_id)
     VALUES ($1)
     ON CONFLICT (telegram_user_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [telegramUserId],
  );
  return result.rows[0].id;
}

export async function saveJdTemplate(input: {
  telegramUserId: string;
  name: string;
  sourceType: "pasted" | "linked_post";
  sourceUrl?: string;
  jdText: string;
}): Promise<JdTemplate | undefined> {
  const database = getPool();
  if (!database) return undefined;
  const userId = await ensureUser(input.telegramUserId);
  const result = await database.query<JdTemplate>(
    `INSERT INTO cv_screener_jd_templates
       (user_id, name, source_type, source_url, jd_text)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, source_type AS "sourceType", source_url AS "sourceUrl",
       title, jd_text AS "jdText", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId, input.name.trim(), input.sourceType, input.sourceUrl ?? null, input.jdText],
  );
  return result.rows[0];
}

export async function listJdTemplates(telegramUserId: string): Promise<JdTemplate[]> {
  const database = getPool();
  if (!database) return [];
  const result = await database.query<JdTemplate>(
    `SELECT t.id, t.name, t.source_type AS "sourceType", t.source_url AS "sourceUrl",
       t.title, t.jd_text AS "jdText", t.created_at AS "createdAt", t.updated_at AS "updatedAt"
     FROM cv_screener_jd_templates t
     JOIN cv_screener_users u ON u.id = t.user_id
     WHERE u.telegram_user_id = $1
     ORDER BY t.updated_at DESC
     LIMIT 20`,
    [telegramUserId],
  );
  return result.rows;
}

export async function getJdTemplate(
  telegramUserId: string,
  templateId: string,
): Promise<JdTemplate | undefined> {
  const database = getPool();
  if (!database) return undefined;
  const result = await database.query<JdTemplate>(
    `SELECT t.id, t.name, t.source_type AS "sourceType", t.source_url AS "sourceUrl",
       t.title, t.jd_text AS "jdText", t.created_at AS "createdAt", t.updated_at AS "updatedAt"
     FROM cv_screener_jd_templates t
     JOIN cv_screener_users u ON u.id = t.user_id
     WHERE u.telegram_user_id = $1 AND t.id = $2`,
    [telegramUserId, templateId],
  );
  return result.rows[0];
}

export async function deleteJdTemplate(
  telegramUserId: string,
  templateId: string,
): Promise<boolean> {
  const database = getPool();
  if (!database) return false;
  const result = await database.query(
    `DELETE FROM cv_screener_jd_templates t
     USING cv_screener_users u
     WHERE t.user_id = u.id AND u.telegram_user_id = $1 AND t.id = $2`,
    [telegramUserId, templateId],
  );
  return result.rowCount === 1;
}
