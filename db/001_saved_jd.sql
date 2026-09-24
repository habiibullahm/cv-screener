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
