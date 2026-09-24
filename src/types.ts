export type SessionStep = "idle" | "awaiting_jd" | "awaiting_cv";

export interface ScreenedResult {
  fileName: string;
  score: number;
}

export interface ChatSession {
  step: SessionStep;
  jdText?: string;
  jdSourceType?: "pasted" | "linked_post";
  jdSourceUrl?: string;
  jdTemplateId?: string;
  /** In-memory scores for the active JD (cleared on new JD / cancel / done). */
  results?: ScreenedResult[];
  lastActivityAt: number;
}

export interface ScoreResult {
  score: number;
  totalKeywords: number;
  matched: string[];
  missing: string[];
}
