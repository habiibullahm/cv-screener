# Database plan and retention

Persistence is limited to user-owned job descriptions. CV bytes, extracted CV text, provider prompts, and provider responses are never written to PostgreSQL.

## Tables

- `cv_screener_users` maps a Telegram user ID to an internal database owner.
- `cv_screener_jd_templates` stores a user-confirmed immutable JD snapshot, its source type, and optional source URL.

Every read, update, and delete scopes by the Telegram user ID. A linked post is fetched once; screening uses the saved text snapshot and never fetches the URL again.

## Lifecycle

- A saved JD remains until the owner deletes it.
- Active screening state remains in memory only and expires after one hour.
- CV data is wiped after processing and is not represented by a database column.
- Apply `db/001_saved_jd.sql` in production, or allow startup schema initialization when `DATABASE_URL` is configured.

## Operations

- `/savejd Nama JD` saves and locks the active JD.
- `/myjd` lists templates owned by the current Telegram account.
- Template buttons load an immutable snapshot or delete the owner’s template.

If the database is not configured, the existing paste/link screening flow continues and saved-JD commands report that persistence is unavailable.
