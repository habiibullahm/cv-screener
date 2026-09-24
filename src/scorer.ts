import type { ScoreResult } from "./types.js";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "are", "our", "this", "that", "from",
  "will", "have", "has", "was", "were", "been", "being", "able", "about", "into",
  "over", "such", "than", "then", "them", "they", "their", "there", "these", "those",
  "what", "when", "where", "which", "who", "whom", "why", "how", "all", "any", "can",
  "may", "must", "should", "would", "could", "also", "not", "but", "or", "as", "at",
  "by", "in", "on", "of", "to", "a", "an", "is", "it", "its", "we", "us", "be",
  "do", "does", "did", "job", "role", "full", "stack", "position", "work", "working", "experience",
  "experienced", "required", "requirements", "requirement", "qualification", "qualifications",
  "responsibilities", "responsibility", "skills", "skill", "ability", "abilities", "knowledge",
  "good", "strong", "plus", "preferred", "prefer", "minimum", "years", "year", "etc",
  "understanding", "familiarity", "familiar", "demonstrated", "especially", "ensure", "ensuring",
  "previous", "actively", "language", "languages", "technologies", "technology", "various",
  "yang", "dan", "dengan", "untuk", "dari", "pada", "dalam", "atau", "adalah", "ini",
  "itu", "kami", "kita", "anda", "kamu", "sebagai", "akan", "sudah", "juga", "bisa",
  "dapat", "memiliki", "pengalaman", "syarat", "kualifikasi", "tanggung", "jawab", "kemampuan",
  "pengetahuan", "minimal", "lebih", "baik", "serta", "bagi", "para", "oleh", "ke", "di",
  "tersebut", "lain", "nya",
]);

const CANONICAL_FORMS = new Map([
  ["developers", "development"],
  ["developer", "development"],
  ["develop", "development"],
  ["developed", "development"],
  ["developing", "development"],
  ["engineering", "engineering"],
  ["engineer", "engineering"],
  ["engineers", "engineering"],
  ["databases", "database"],
  ["database", "database"],
  ["apis", "api"],
  ["api", "api"],
  ["frameworks", "framework"],
  ["framework", "framework"],
  ["tests", "testing"],
  ["test", "testing"],
  ["testing", "testing"],
  ["programmer", "programming"],
  ["programmers", "programming"],
  ["programming", "programming"],
  ["programs", "programming"],
]);

const RELATED_TERMS = new Map<string, string[]>([
  ["development", ["developer", "develop", "developed", "developing", "building", "built", "engineered"]],
  ["engineering", ["engineer", "software", "developer", "development"]],
  ["programming", ["java", "javascript", "typescript", "python", "c#", "c++", "golang", "kotlin", "ruby", "php"]],
  ["javascript", ["javascript", "typescript", "node.js", "nodejs"]],
  ["database", ["database", "databases", "postgresql", "postgis", "mysql", "mongodb", "redis", "prisma", "sql"]],
  ["framework", ["framework", "spring", "spring boot", "react", "react native", "next.js", "nextjs", "vite", "angular", "vue"]],
  ["api", ["api", "apis", "rest", "restful", "graphql"]],
  ["testing", ["test", "tests", "testing", "junit", "mockito", "testcontainers", "cypress", "playwright"]],
  ["team", ["team", "teams", "collaboration", "collaborative", "cross-functional"]],
]);

const MAX_KEYWORDS = 40;
const MAX_LIST = 15;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalize(token: string): string {
  return CANONICAL_FORMS.get(token) ?? token;
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((token) => token.replace(/^[-.]+|[-.]+$/g, ""))
    .map(canonicalize)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function extractKeywords(jdText: string): string[] {
  const counts = new Map<string, number>();

  for (const token of tokenize(jdText)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_KEYWORDS)
    .map(([keyword]) => keyword);
}

function termPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?:[^a-z0-9+#]|$)`, "i");
}

function keywordMatches(cvText: string, keyword: string): boolean {
  const candidates = [keyword, ...(RELATED_TERMS.get(keyword) ?? [])];
  return candidates.some((candidate) => termPattern(candidate).test(cvText));
}

export function scoreCvAgainstJd(jdText: string, cvText: string): ScoreResult {
  const keywords = extractKeywords(jdText);
  const normalizedCv = normalize(cvText);

  if (keywords.length === 0) {
    return { score: 0, totalKeywords: 0, matched: [], missing: [] };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of keywords) {
    if (keywordMatches(normalizedCv, keyword)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  return {
    score: Math.round((matched.length / keywords.length) * 100),
    totalKeywords: keywords.length,
    matched: matched.slice(0, MAX_LIST),
    missing: missing.slice(0, MAX_LIST),
  };
}
