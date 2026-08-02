import type { ScoreResult } from "./types.js";

const STOPWORDS = new Set([
  // English
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "are",
  "our",
  "this",
  "that",
  "from",
  "will",
  "have",
  "has",
  "was",
  "were",
  "been",
  "being",
  "able",
  "about",
  "into",
  "over",
  "such",
  "than",
  "then",
  "them",
  "they",
  "their",
  "there",
  "these",
  "those",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "how",
  "all",
  "any",
  "can",
  "may",
  "must",
  "should",
  "would",
  "could",
  "also",
  "not",
  "but",
  "or",
  "as",
  "at",
  "by",
  "in",
  "on",
  "of",
  "to",
  "a",
  "an",
  "is",
  "it",
  "its",
  "we",
  "us",
  "be",
  "do",
  "does",
  "did",
  "job",
  "role",
  "position",
  "work",
  "working",
  "experience",
  "experienced",
  "required",
  "requirements",
  "requirement",
  "qualification",
  "qualifications",
  "responsibilities",
  "responsibility",
  "skills",
  "skill",
  "ability",
  "abilities",
  "knowledge",
  "good",
  "strong",
  "plus",
  "preferred",
  "prefer",
  "minimum",
  "years",
  "year",
  "etc",
  // Indonesian
  "yang",
  "dan",
  "dengan",
  "untuk",
  "dari",
  "pada",
  "dalam",
  "atau",
  "adalah",
  "ini",
  "itu",
  "kami",
  "kita",
  "anda",
  "kamu",
  "sebagai",
  "akan",
  "sudah",
  "juga",
  "bisa",
  "dapat",
  "memiliki",
  "pengalaman",
  "syarat",
  "kualifikasi",
  "tanggung",
  "jawab",
  "kemampuan",
  "pengetahuan",
  "minimal",
  "lebih",
  "baik",
  "serta",
  "bagi",
  "para",
  "oleh",
  "ke",
  "di",
  "tersebut",
  "lain",
  "nya",
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

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((token) => token.replace(/^[-.]+|[-.]+$/g, ""))
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

function keywordMatches(cvText: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?:[^a-z0-9+#]|$)`, "i");
  return pattern.test(cvText);
}

export function scoreCvAgainstJd(jdText: string, cvText: string): ScoreResult {
  const keywords = extractKeywords(jdText);
  const normalizedCv = normalize(cvText);

  if (keywords.length === 0) {
    return {
      score: 0,
      totalKeywords: 0,
      matched: [],
      missing: [],
    };
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

  const score = Math.round((matched.length / keywords.length) * 100);

  return {
    score,
    totalKeywords: keywords.length,
    matched: matched.slice(0, MAX_LIST),
    missing: missing.slice(0, MAX_LIST),
  };
}
