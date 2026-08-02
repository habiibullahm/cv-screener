import type { ChatSession, ScreenedResult, SessionStep } from "./types.js";

const MAX_STORED_RESULTS = 20;
const MAX_TRACKED_BOT_MESSAGES = 100;

const sessions = new Map<number, ChatSession>();
/** Bot message IDs per chat — kept separate so screening resets don't wipe clear-history. */
const botMessages = new Map<number, number[]>();

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
    session.results = [];
  }
  sessions.set(chatId, session);
  return session;
}

/** Start a fresh screening: clear JD + results, await new JD. */
export function beginFreshScreen(chatId: number): ChatSession {
  const session: ChatSession = { step: "awaiting_jd" };
  sessions.set(chatId, session);
  return session;
}

/** Keep JD, clear ranking list, ask for a new JD. */
export function changeJd(chatId: number): ChatSession {
  const session: ChatSession = { step: "awaiting_jd" };
  sessions.set(chatId, session);
  return session;
}

/** After a score: keep JD, stay ready for another CV PDF. */
export function keepJdAwaitingCv(chatId: number): ChatSession {
  const session = getSession(chatId);
  session.step = "awaiting_cv";
  sessions.set(chatId, session);
  return session;
}

export function addScreenedResult(chatId: number, entry: ScreenedResult): ChatSession {
  const session = getSession(chatId);
  const results = session.results ?? [];
  results.push(entry);
  if (results.length > MAX_STORED_RESULTS) {
    session.results = results.slice(results.length - MAX_STORED_RESULTS);
  } else {
    session.results = results;
  }
  sessions.set(chatId, session);
  return session;
}

export function trackBotMessage(chatId: number, messageId: number): void {
  const list = botMessages.get(chatId) ?? [];
  if (!list.includes(messageId)) {
    list.push(messageId);
  }
  if (list.length > MAX_TRACKED_BOT_MESSAGES) {
    list.splice(0, list.length - MAX_TRACKED_BOT_MESSAGES);
  }
  botMessages.set(chatId, list);
}

/** Returns tracked bot message IDs and clears the list. */
export function takeBotMessages(chatId: number): number[] {
  const list = botMessages.get(chatId) ?? [];
  botMessages.delete(chatId);
  return list;
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
}
