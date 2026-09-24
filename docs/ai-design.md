# AI Explanation Design

## Contract

The LLM explains a deterministic `ScoreResult`; it does not score. Output fields are:

- `summary`: bounded non-empty string
- `matchedRequirements`: exact deterministic matched list
- `missingRequirements`: exact deterministic missing list
- `confidence`: finite number from `0` to `1`
- `recommendation`: `strong_match`, `review`, or `weak_match`
- `interviewQuestions`: up to three bounded non-empty strings

Any type, range, length, count, or requirement-list mismatch causes fallback. Recommendation is derived from the deterministic score band and is not accepted from the model when it conflicts.

## Configuration

- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GROQ_BASE_URL`
- `GROQ_TIMEOUT_MS` (clamped to a maximum of eight seconds)

## Prompt-injection defense

Semantic assessment sends bounded CV/JD text to Groq transiently. The system prompt clearly labels both values as untrusted data, instructs the model to ignore embedded commands, and requires evidence grounding. The application validates that requirements originate from the JD and evidence exists in the CV. No CV/JD text or provider response is logged or persisted by this application.

## Semantic requirement assessment

When JD and extracted CV text are available, the request asks the provider to assess up to ten job requirements. Each requirement must be copied from the JD. For `matched` or `partial` status, evidence must be copied from the CV; `missing` and `unclear` entries must use `No direct evidence found.`. Invalid grounding falls back to deterministic output.

This semantic layer enriches screening with related specifications, but it does not modify the deterministic keyword score, matched list, missing list, or score-band recommendation.

## Fallback

Fallback text is deterministic. Recommendation follows the score bands from the existing scorer, missing requirements come from `ScoreResult.missing`, and interview questions are generated from those missing keywords.
