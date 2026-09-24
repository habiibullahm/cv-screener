# Threat Model

## Assets

- CV and JD contents
- Telegram bot token and Groq API key
- Saved JD templates and candidate screening output
- Provider response integrity

## Trust boundaries

1. Telegram user input and file metadata enter the bot.
2. PDF extraction produces untrusted text.
3. JD URL fetching crosses an outbound network boundary.
4. Bounded CV/JD text crosses the configured Groq provider boundary for semantic explanation.
5. PostgreSQL stores only user-owned JD snapshots when enabled.
6. Groq returns untrusted JSON.
7. Telegram HTML renderer consumes generated output.

## Controls

- Rule-based score is calculated locally and cannot be overwritten by the LLM.
- CV bytes and extracted CV text are not persisted by this application.
- Saved JD queries are scoped by the authenticated Telegram user ID and active screening uses an immutable snapshot.
- Provider output has strict schema, enum, range, length, count, and evidence/list validation.
- Provider calls have an eight-second maximum timeout and deterministic fallback.
- Telegram output escapes `&`, `<`, and `>`.
- Logs exclude API keys, CV/JD text, raw provider responses, file URLs, and file identifiers.
- PDF download has a size cap and buffers are wiped after processing.
- Sessions expire after one hour and are cleaned without holding process shutdown.
- Provider retention and training settings must be reviewed before sending CV/JD text to an external provider.

## Residual risks

- In-memory text can exist briefly in process memory and cannot be guaranteed erased by JavaScript runtime internals.
- The deterministic scorer is keyword-based and may miss semantic equivalence.
- Linked posts may be dynamic, require authentication, or change after a snapshot is saved.
- Telegram transport, PostgreSQL availability, and provider availability remain external dependencies.
