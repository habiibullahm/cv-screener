export type SessionStep = "idle" | "awaiting_jd" | "awaiting_cv";

export interface ChatSession {
  step: SessionStep;
  jdText?: string;
}

export interface ScoreResult {
  score: number;
  totalKeywords: number;
  matched: string[];
  missing: string[];
}
