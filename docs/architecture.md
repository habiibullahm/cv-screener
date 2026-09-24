# Architecture

## Runtime flow

Telegram update → `src/bot.ts` → in-memory session → PDF download/extraction → `src/scorer.ts` → deterministic `ScoreResult` → optional `src/explanation.ts` → escaped Telegram HTML.

`src/scorer.ts` is the source of truth. The explanation module cannot change the score, matched keywords, missing keywords, or score-band recommendation.

## Data lifetime

- CV PDF bytes exist only in memory and are wiped in success and error paths.
- Active session data is in memory only and expires after one hour of inactivity.
- Saved JD templates are optional PostgreSQL records scoped to the owning Telegram user; they contain only the user-confirmed JD snapshot and source metadata.
- CV bytes and extracted CV text are never persisted.
- For semantic explanation only, bounded CV/JD text is sent transiently to the configured Groq-compatible provider. It is not stored by this application; provider retention depends on the configured provider policy.
- The session cleanup timer uses `unref()` so it does not keep the process alive during shutdown.

## Provider boundary

The provider is Groq OpenAI-compatible and called with native `fetch`. The provider response is untrusted input and is validated before rendering. Provider failure, timeout, malformed JSON, or schema mismatch returns the deterministic fallback. Prompt-injection instructions in CV/JD are treated as data, not commands.

## Saved JD boundary

A linked post is fetched once and shown as the active JD. `/savejd Name JD` stores a user-owned immutable snapshot; `/myjd` loads that snapshot for future screening. Screening never re-fetches a saved source URL.
