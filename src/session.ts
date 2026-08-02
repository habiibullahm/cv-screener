import type { ChatSession, SessionStep } from "./types.js";

const sessions = new Map<number, ChatSession>();

export function getSession(chatId: number): ChatSession {
  const existing = sessions.get(chatId);
  if (existing) return existing;

  const created: ChatSession = { step: "idle" };
  sessions.set(chatId, created);
  return created;
}

export function setStep(chatId: number, step: SessionStep, jdText?: string): ChatSession {
  const session = getSession(chatId);
  session.step = step;
  if (jdText !== undefined) {
    session.jdText = jdText;
  }
  sessions.set(chatId, session);
  return session;
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
}
