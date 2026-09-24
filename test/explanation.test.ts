import assert from "node:assert/strict";
import test from "node:test";
import { explainScore } from "../src/explanation.js";
import { formatScoreMessage } from "../src/messages.js";
import { cleanupExpiredSessions, getSession, SESSION_TTL_MS } from "../src/session.js";
import type { ScoreResult } from "../src/types.js";

const result: ScoreResult = {
  score: 50,
  totalKeywords: 4,
  matched: ["typescript", "react"],
  missing: ["testing", "aws"],
};

function providerResponse(content: unknown, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

function validOutput(scoreResult = result) {
  return JSON.stringify({
    summary: "Review the matched requirements and verify the gaps.",
    matchedRequirements: scoreResult.matched,
    missingRequirements: scoreResult.missing,
    confidence: 0.8,
    recommendation: "review",
    interviewQuestions: ["Can you describe your testing experience?"],
  });
}

test("uses deterministic fallback without API key", async () => {
  const explanation = await explainScore(result, { apiKey: "" });
  assert.equal(explanation.source, "fallback");
  assert.deepEqual(explanation.missingRequirements, result.missing);
  assert.equal(explanation.recommendation, "review");
  assert.equal(explanation.interviewQuestions.length, 2);
});

test("falls back on provider failure", async () => {
  const explanation = await explainScore(result, {
    apiKey: "test-key",
    baseUrl: "https://provider.test/v1",
    fetchImpl: async () => providerResponse({}, 503),
  });
  assert.equal(explanation.source, "fallback");
});

test("falls back on timeout", async () => {
  const explanation = await explainScore(result, {
    apiKey: "test-key",
    timeoutMs: 100,
    fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")));
    }),
  });
  assert.equal(explanation.source, "fallback");
});

test("falls back on malformed JSON", async () => {
  const explanation = await explainScore(result, {
    apiKey: "test-key",
    fetchImpl: async () => providerResponse("not-json"),
  });
  assert.equal(explanation.source, "fallback");
});

test("falls back on invalid schema or changed requirements", async () => {
  const explanation = await explainScore(result, {
    apiKey: "test-key",
    fetchImpl: async () => providerResponse(JSON.stringify({
      summary: "bad",
      matchedRequirements: ["invented"],
      missingRequirements: result.missing,
      confidence: 2,
      recommendation: "review",
      interviewQuestions: [],
    })),
  });
  assert.equal(explanation.source, "fallback");
});

test("rejects an explanation that contradicts the deterministic score", async () => {
  const weakResult = { ...result, score: 20 };
  const explanation = await explainScore(weakResult, {
    apiKey: "test-key",
    fetchImpl: async () => providerResponse(JSON.stringify({
      summary: "Overall fit is moderate.",
      matchedRequirements: weakResult.matched,
      missingRequirements: weakResult.missing,
      confidence: 0.55,
      recommendation: "review",
      interviewQuestions: ["What experience do you have with Python or Node.js?"],
    })),
  });
  assert.equal(explanation.source, "fallback");
  assert.equal(explanation.recommendation, "weak_match");
});
test("fallback recommendation follows deterministic score", async () => {
  const strong = await explainScore({ ...result, score: 80 }, { apiKey: "" });
  const weak = await explainScore({ ...result, score: 20 }, { apiKey: "" });
  assert.equal(strong.recommendation, "strong_match");
  assert.equal(weak.recommendation, "weak_match");
});

test("valid provider output preserves deterministic requirements", async () => {
  const explanation = await explainScore(result, {
    apiKey: "test-key",
    fetchImpl: async () => providerResponse(validOutput()),
  });
  assert.equal(explanation.source, "llm");
  assert.deepEqual(explanation.matchedRequirements, result.matched);
  assert.deepEqual(explanation.missingRequirements, result.missing);
});

test("accepts grounded semantic requirement evidence", async () => {
  const semanticResult: ScoreResult = {
    score: 50,
    totalKeywords: 1,
    matched: ["typescript"],
    missing: ["python"],
  };
  const explanation = await explainScore(semanticResult, {
    apiKey: "test-key",
    jdText: "Strong TypeScript engineer with Python experience.",
    cvText: "Built production TypeScript services.",
    fetchImpl: async () => providerResponse(JSON.stringify({
      summary: "Review the missing requirement.",
      matchedRequirements: semanticResult.matched,
      missingRequirements: semanticResult.missing,
      confidence: 0.7,
      recommendation: "review",
      interviewQuestions: ["Can you describe your Python experience?"],
      semanticRequirements: [
        {
          requirement: "TypeScript",
          status: "matched",
          evidence: "TypeScript",
          reason: "The CV names TypeScript experience.",
        },
        {
          requirement: "Python",
          status: "missing",
          evidence: "No direct evidence found.",
          reason: "The CV does not provide direct Python evidence.",
        },
      ],
    })),
  });
  assert.equal(explanation.source, "llm");
  assert.equal(explanation.semanticRequirements[0]?.status, "matched");
});

test("rejects semantic evidence not present in the CV", async () => {
  const explanation = await explainScore(result, {
    apiKey: "test-key",
    jdText: "Python experience is required.",
    cvText: "Experienced with TypeScript.",
    fetchImpl: async () => providerResponse(JSON.stringify({
      summary: "Review the gap.",
      matchedRequirements: result.matched,
      missingRequirements: result.missing,
      confidence: 0.5,
      recommendation: "review",
      interviewQuestions: ["Can you describe your Python experience?"],
      semanticRequirements: [{
        requirement: "Python",
        status: "matched",
        evidence: "Python",
        reason: "The CV shows Python experience.",
      }],
    })),
  });
  assert.equal(explanation.source, "fallback");
});
test("Telegram output escapes explanation HTML", () => {
  const output = formatScoreMessage(result, "candidate<1>.pdf", {
    summary: "<script>alert(1)</script>",
    matchedRequirements: result.matched,
    missingRequirements: result.missing,
    confidence: 0.5,
    recommendation: "review",
    interviewQuestions: ["What about <aws>?"],
    semanticRequirements: [],
    source: "fallback",
  });
  assert.match(output, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(output, /What about &lt;aws&gt;\?/);
  assert.doesNotMatch(output, /<script>/);
});

test("sessions expire after one hour", () => {
  const chatId = 987654;
  const session = getSession(chatId);
  session.lastActivityAt = Date.now() - SESSION_TTL_MS - 1;
  assert.equal(cleanupExpiredSessions(), 1);
  assert.equal(getSession(chatId).step, "idle");
});
