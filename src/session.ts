import type { ChatSession, ScreenedResult, SessionStep } from "./types.js";

const MAX_STORED_RESULTS = 20;
const MAX_TRACKED_BOT_MESSAGES = 100;
export const SESSION_TTL_MS = 60 * 60 * 1000;

const sessions = new Map<number, ChatSession>();
const botMessages = new Map<number, number[]>();

function touch(session: ChatSession): ChatSession {
  session.lastActivityAt = Date.now();
  return session;
}

export function getSession(chatId: number): ChatSession {
  const existing = sessions.get(chatId);
  if (existing && Date.now() - existing.lastActivityAt <= SESSION_TTL_MS) {
    return touch(existing);
  }
  if (existing) {
    sessions.delete(chatId);
    botMessages.delete(chatId);
  }

  const created: ChatSession = touch({ step: "idle", lastActivityAt: Date.now() });
  sessions.set(chatId, created);
  return created;
}

export function setStep(
  chatId: number,
  step: SessionStep,
  jdText?: string,
  source?: { type: "pasted" | "linked_post"; url?: string; templateId?: string },
): ChatSession {
  const session = getSession(chatId);
  session.step = step;
  if (jdText !== undefined) {
    session.jdText = jdText;
    session.jdSourceType = source?.type;
    session.jdSourceUrl = source?.url;
    session.jdTemplateId = source?.templateId;
    session.results = [];
  }
  sessions.set(chatId, touch(session));
  return session;
}

export function beginFreshScreen(chatId: number): ChatSession {
  const session = touch({ step: "awaiting_jd", lastActivityAt: Date.now() });
  sessions.set(chatId, session);
  return session;
}

export function changeJd(chatId: number): ChatSession {
  const session = touch({ step: "awaiting_jd", lastActivityAt: Date.now() });
  sessions.set(chatId, session);
  return session;
}

export function keepJdAwaitingCv(chatId: number): ChatSession {
  const session = getSession(chatId);
  session.step = "awaiting_cv";
  sessions.set(chatId, touch(session));
  return session;
}

export function addScreenedResult(chatId: number, entry: ScreenedResult): ChatSession {
  const session = getSession(chatId);
  const results = session.results ?? [];
  results.push(entry);
  session.results = results.length > MAX_STORED_RESULTS
    ? results.slice(results.length - MAX_STORED_RESULTS)
    : results;
  sessions.set(chatId, touch(session));
  return session;
}

export function trackBotMessage(chatId: number, messageId: number): void {
  getSession(chatId);
  const list = botMessages.get(chatId) ?? [];
  if (!list.includes(messageId)) list.push(messageId);
  if (list.length > MAX_TRACKED_BOT_MESSAGES) list.splice(0, list.length - MAX_TRACKED_BOT_MESSAGES);
  botMessages.set(chatId, list);
}

export function takeBotMessages(chatId: number): number[] {
  const list = botMessages.get(chatId) ?? [];
  botMessages.delete(chatId);
  return list;
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
  botMessages.delete(chatId);
}

export function cleanupExpiredSessions(now = Date.now()): number {
  let removed = 0;
  for (const [chatId, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      sessions.delete(chatId);
      botMessages.delete(chatId);
      removed += 1;
    }
  }
  return removed;
}

const cleanupTimer = setInterval(() => cleanupExpiredSessions(), SESSION_TTL_MS);
cleanupTimer.unref();

export function stopSessionCleanup(): void {
  clearInterval(cleanupTimer);
}
