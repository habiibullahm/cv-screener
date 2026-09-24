# Evaluation

## Automated verification

Run from the repository root:

```bash
npm run typecheck
npm test
npm run build
```

Tests cover missing API key fallback, provider failure, timeout, malformed JSON, invalid schema, exact matched/missing preservation, score-based recommendation, Telegram HTML escaping, and session expiry. The build command verifies the production `dist/` output used by Docker.

## Manual smoke test

1. Configure `BOT_TOKEN` and leave `GROQ_API_KEY` empty.
2. Run `npm start`.
3. Start `/screen`, paste a JD, and upload a text PDF.
4. Confirm the score and deterministic fallback explanation appear.
5. Configure the Groq OpenAI-compatible variables and repeat.
6. Confirm the score, matched list, and missing list remain unchanged.
7. Include `<`, `>`, and `&` in a controlled provider response and confirm Telegram renders escaped text.

## Known limitations

- No OCR for image-only PDFs.
- Sessions and scores disappear on process restart.
- Provider explanations are optional and not a hiring decision.
- No end-to-end Telegram test is included; it requires a real bot token and external services.

## Verification boundary

The default automated suite uses mocked provider responses so it is safe and repeatable without credentials. A manual smoke test with `BOT_TOKEN`, optional `GROQ_API_KEY`, and `DATABASE_URL` is still required before production release to verify Telegram, Groq, and Neon connectivity together.
