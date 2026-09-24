import assert from "node:assert/strict";
import test from "node:test";
import { scoreCvAgainstJd } from "../src/scorer.js";

test("matches related full-stack requirements without generic filler words", () => {
  const jd = [
    "Full Stack Developer with hands-on development and programming experience.",
    "Understanding and familiarity with team technologies, frameworks, JavaScript, databases, and Kubernetes.",
    "Experience with Java, React, web APIs, and testing.",
  ].join(" ");
  const cv = [
    "Full-Stack Software Developer with Java, Spring Boot, React, React Native, and TypeScript.",
    "Built secure REST APIs with PostgreSQL and Redis for production systems.",
    "Worked in cross-functional teams and wrote JUnit integration tests.",
  ].join(" ");

  const result = scoreCvAgainstJd(jd, cv);

  assert.ok(result.score >= 75, `expected related skills to score >= 75, got ${result.score}`);
  assert.ok(result.matched.includes("development"));
  assert.ok(result.matched.includes("programming"));
  assert.ok(result.matched.includes("framework"));
  assert.ok(result.matched.includes("database"));
  assert.ok(result.matched.includes("javascript"));
  assert.ok(result.missing.includes("kubernetes"));
  assert.ok(!result.missing.includes("understanding"));
  assert.ok(!result.missing.includes("familiarity"));
});

test("keeps genuinely missing technical skills visible", () => {
  const result = scoreCvAgainstJd(
    "Experience with Kubernetes, Python, and GraphQL.",
    "Built Java and React applications with REST APIs.",
  );

  assert.deepEqual(result.missing, ["graphql", "kubernetes", "python"]);
  assert.equal(result.score, 0);
});
