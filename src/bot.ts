import { Bot, InlineKeyboard, type Context } from "grammy";
import { fetchJdFromUrl, isHttpUrl, JdFetchError } from "./jdUrl.js";
import {
  ASK_CV_MESSAGE,
  ASK_CV_NEXT_MESSAGE,
  ASK_CV_PDF_ONLY_MESSAGE,
  ASK_JD_MESSAGE,
  CANCEL_MESSAGE,
  CLEAR_MESSAGE,
  DONE_MESSAGE,
  HELP_MESSAGE,
  IDLE_HINT_MESSAGE,
  INVALID_JD_MESSAGE,
  START_MESSAGE,
  afterResultKeyboard,
  escapeHtml,
  formatRankingMessage,
  formatScoreMessage,
  mainKeyboard,
} from "./messages.js";
import { extractTextFromPdf } from "./pdf.js";
import { scoreCvAgainstJd } from "./scorer.js";
import { explainScore } from "./explanation.js";
import {
  deleteJdTemplate,
  getJdTemplate,
  isStorageConfigured,
  listJdTemplates,
  saveJdTemplate,
} from "./storage.js";
import {
  SecurePdfError,
  assertAllowedCvFileSize,
  downloadTelegramFileCapped,
  wipeBuffer,
} from "./securePdf.js";
import {
  addScreenedResult,
  beginFreshScreen,
  changeJd,
  clearSession,
  getSession,
  keepJdAwaitingCv,
  setStep,
  takeBotMessages,
  trackBotMessage,
} from "./session.js";

const replyOpts = {
  parse_mode: "HTML" as const,
  reply_markup: mainKeyboard,
  link_preview_options: { is_disabled: true },
};

const cancelKeyboard = new InlineKeyboard()
  .text("Batal", "cancel")
  .text("Clear chat", "clear");

const sessionReplyOpts = {
  parse_mode: "HTML" as const,
  reply_markup: cancelKeyboard,
  link_preview_options: { is_disabled: true },
};

const JD_HINT_PATTERN =
  /\b(require|qualif|experience|skill|responsib|year|degree|developer|engineer|manager|kualifikasi|persyaratan|pengalaman|tanggung|vacancy|position|role|job|hiring)\b/i;

function isLikelyJdText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 20) return false;

  const words = trimmed.split(/\s+/).filter((word) => word.length > 0);
  const letterCount = (trimmed.match(/\p{L}/gu) ?? []).length;
  const letterRatio = letterCount / trimmed.length;

  if (letterRatio < 0.35) return false;
  if (words.length < 3 && trimmed.length < 45) return false;

  const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, "")).size;
  if (trimmed.length >= 20 && uniqueChars < 5) return false;

  if (trimmed.length < 60 && words.length < 8 && !JD_HINT_PATTERN.test(trimmed)) {
    return false;
  }

  return true;
}

async function replyTracked(
  ctx: Context,
  text: string,
  opts?: Parameters<Context["reply"]>[1],
): Promise<void> {
  const msg = await ctx.reply(text, opts);
  const chatId = ctx.chat?.id;
  if (chatId !== undefined) trackBotMessage(chatId, msg.message_id);
}

function trackId(chatId: number, messageId: number): void {
  trackBotMessage(chatId, messageId);
}

function telegramUserId(ctx: Context): string | undefined {
  return ctx.from?.id.toString();
}

function commandArgument(ctx: Context): string {
  const text = ctx.message?.text ?? "";
  return text.replace(/^\/\w+(?:@\w+)?\s*/u, "").trim();
}

function templateListMessage(count: number): string {
  if (count === 0) {
    return [
      "<b>Saved JD</b>",
      "Belum ada JD tersimpan.",
      "Mulai screening, lalu gunakan <code>/savejd Nama JD</code>.",
    ].join("\n");
  }
  return [
    "<b>Saved JD</b>",
    "Pilih template untuk mengunci snapshot JD dan mulai screening:",
  ].join("\n");
}
function templateDetailsMessage(template: {
  name: string;
  sourceType: "pasted" | "linked_post";
  sourceUrl?: string;
  jdText: string;
  createdAt: string;
}): string {
  const source = template.sourceType === "linked_post" ? "Linked post" : "Paste manual";
  const sourceLine = template.sourceUrl
    ? `Sumber: ${escapeHtml(template.sourceUrl)}`
    : `Sumber: ${source}`;
  const jdText = template.jdText.length > 3400
    ? `${template.jdText.slice(0, 3400)}\n… (dipotong)`
    : template.jdText;
  return [
    `<b>JD: ${escapeHtml(template.name)}</b>`,
    `Source type: ${escapeHtml(source)}`,
    sourceLine,
    `Dibuat: ${escapeHtml(new Date(template.createdAt).toLocaleString("id-ID"))}`,
    "",
    `<pre>${escapeHtml(jdText)}</pre>`,
  ].join("\n");
}
async function replyIdleHint(ctx: Context): Promise<void> {
  await replyTracked(ctx, IDLE_HINT_MESSAGE, replyOpts);
}

async function replyInvalidJd(ctx: Context): Promise<void> {
  await replyTracked(ctx, INVALID_JD_MESSAGE, sessionReplyOpts);
}

async function replyAskCvPdfOnly(ctx: Context): Promise<void> {
  await replyTracked(ctx, ASK_CV_PDF_ONLY_MESSAGE, sessionReplyOpts);
}

async function beginScreen(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  beginFreshScreen(chatId);
  await replyTracked(ctx, ASK_JD_MESSAGE, {
    parse_mode: "HTML",
    reply_markup: cancelKeyboard,
  });
}

async function cancelScreen(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  clearSession(chatId);
  await replyTracked(ctx, CANCEL_MESSAGE, {
    parse_mode: "HTML",
    reply_markup: mainKeyboard,
    link_preview_options: { is_disabled: true },
  });
}

async function finishDone(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId !== undefined) clearSession(chatId);
  await replyTracked(ctx, DONE_MESSAGE, replyOpts);
}

async function clearChat(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  const messageIds = takeBotMessages(chatId);
  clearSession(chatId);

  for (const messageId of messageIds) {
    try {
      await ctx.api.deleteMessage(chatId, messageId);
    } catch {
      // Message may already be gone or too old (>48h).
    }
  }

  await replyTracked(ctx, CLEAR_MESSAGE, replyOpts);
}

function isPdfDocument(ctx: Context): boolean {
  const doc = ctx.message?.document;
  if (!doc) return false;

  const mime = doc.mime_type?.toLowerCase() ?? "";
  const name = doc.file_name?.toLowerCase() ?? "";
  return mime === "application/pdf" || name.endsWith(".pdf");
}

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    await replyTracked(ctx, START_MESSAGE, replyOpts);
  });

  bot.command("help", async (ctx) => {
    await replyTracked(ctx, HELP_MESSAGE, replyOpts);
  });

  bot.command("screen", async (ctx) => {
    await beginScreen(ctx);
  });

  bot.command("savejd", async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = telegramUserId(ctx);
    const name = commandArgument(ctx);
    const session = chatId === undefined ? undefined : getSession(chatId);

    if (!userId || !chatId || !session?.jdText) {
      await replyTracked(ctx, "Belum ada JD aktif. Mulai dengan <code>/screen</code>.", replyOpts);
      return;
    }
    if (!isStorageConfigured()) {
      await replyTracked(ctx, "Penyimpanan JD belum dikonfigurasi oleh admin.", replyOpts);
      return;
    }
    if (name.length < 1 || name.length > 120) {
      await replyTracked(ctx, "Format: <code>/savejd Nama JD</code> (1–120 karakter).", replyOpts);
      return;
    }

    try {
      const template = await saveJdTemplate({
        telegramUserId: userId,
        name,
        sourceType: session.jdSourceType ?? "pasted",
        sourceUrl: session.jdSourceUrl,
        jdText: session.jdText,
      });
      await replyTracked(
        ctx,
        template
          ? `JD <b>${escapeHtml(template.name)}</b> tersimpan dan dikunci. Snapshot ini dipakai untuk screening berikutnya.`
          : "Penyimpanan JD belum aktif.",
        replyOpts,
      );
    } catch {
      await replyTracked(ctx, "JD gagal disimpan. Coba lagi nanti.", replyOpts);
    }
  });

  bot.command("myjd", async (ctx) => {
    const userId = telegramUserId(ctx);
    if (!userId || !isStorageConfigured()) {
      await replyTracked(ctx, "Saved JD belum tersedia. Admin perlu mengatur database.", replyOpts);
      return;
    }
    try {
      const templates = await listJdTemplates(userId);
      const keyboard = new InlineKeyboard();
      for (const template of templates) {
        keyboard.text(`Detail: ${template.name.slice(0, 30)}`, `viewjd:${template.id}`).row();
        keyboard.text(`Gunakan: ${template.name.slice(0, 30)}`, `usejd:${template.id}`).row();
        keyboard.text(`Hapus: ${template.name.slice(0, 30)}`, `deletejd:${template.id}`).row();
      }
      await replyTracked(ctx, templateListMessage(templates.length), {
        ...replyOpts,
        reply_markup: keyboard,
      });
    } catch {
      await replyTracked(ctx, "Saved JD gagal dibaca. Coba lagi nanti.", replyOpts);
    }
  });
  bot.command("cancel", async (ctx) => {
    await cancelScreen(ctx);
  });

  bot.command("done", async (ctx) => {
    await finishDone(ctx);
  });

  bot.command("clear", async (ctx) => {
    await clearChat(ctx);
  });

  bot.callbackQuery("screen", async (ctx) => {
    await ctx.answerCallbackQuery();
    await beginScreen(ctx);
  });

  bot.callbackQuery("help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await replyTracked(ctx, HELP_MESSAGE, replyOpts);
  });

  bot.callbackQuery("cancel", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Dibatalkan" });
    await cancelScreen(ctx);
  });

  bot.callbackQuery("done", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Thank you!" });
    await finishDone(ctx);
  });

  bot.callbackQuery("clear", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Clearing…" });
    await clearChat(ctx);
  });

  bot.command("showjd", async (ctx) => {
    const userId = telegramUserId(ctx);
    const templateId = commandArgument(ctx);
    if (!userId || !isStorageConfigured() || !templateId) {
      await replyTracked(ctx, "Format: <code>/showjd TEMPLATE_ID</code>. Gunakan <code>/myjd</code> untuk melihat tombol detail.", replyOpts);
      return;
    }
    try {
      const template = await getJdTemplate(userId, templateId);
      await replyTracked(
        ctx,
        template ? templateDetailsMessage(template) : "JD tidak ditemukan atau bukan milik akun ini.",
        replyOpts,
      );
    } catch {
      await replyTracked(ctx, "Detail JD gagal dimuat. Coba lagi nanti.", replyOpts);
    }
  });

  bot.callbackQuery(/^viewjd:(.+)$/u, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = telegramUserId(ctx);
    const templateId = ctx.match?.[1];
    if (!userId || !templateId) return;
    try {
      const template = await getJdTemplate(userId, templateId);
      await replyTracked(
        ctx,
        template ? templateDetailsMessage(template) : "JD tidak ditemukan atau bukan milik akun ini.",
        replyOpts,
      );
    } catch {
      await replyTracked(ctx, "Detail JD gagal dimuat. Coba lagi nanti.", replyOpts);
    }
  });
  bot.callbackQuery(/^usejd:(.+)$/u, async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    const userId = telegramUserId(ctx);
    const templateId = ctx.match?.[1];
    if (!chatId || !userId || !templateId) return;
    try {
      const template = await getJdTemplate(userId, templateId);
      if (!template) {
        await replyTracked(ctx, "JD tidak ditemukan atau bukan milik akun ini.", replyOpts);
        return;
      }
      setStep(chatId, "awaiting_cv", template.jdText, {
        type: template.sourceType,
        url: template.sourceUrl,
        templateId: template.id,
      });
      await replyTracked(ctx, ASK_CV_MESSAGE, sessionReplyOpts);
    } catch {
      await replyTracked(ctx, "JD gagal dimuat. Coba lagi nanti.", replyOpts);
    }
  });

  bot.callbackQuery(/^deletejd:(.+)$/u, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = telegramUserId(ctx);
    const templateId = ctx.match?.[1];
    if (!userId || !templateId) return;
    try {
      const deleted = await deleteJdTemplate(userId, templateId);
      await replyTracked(ctx, deleted ? "JD dihapus." : "JD tidak ditemukan.", replyOpts);
    } catch {
      await replyTracked(ctx, "JD gagal dihapus. Coba lagi nanti.", replyOpts);
    }
  });
  bot.callbackQuery("next_cv", async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;

    const session = getSession(chatId);
    if (!session.jdText) {
      await beginScreen(ctx);
      return;
    }

    keepJdAwaitingCv(chatId);
    await replyTracked(ctx, ASK_CV_NEXT_MESSAGE, sessionReplyOpts);
  });

  bot.callbackQuery("change_jd", async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;

    changeJd(chatId);
    await replyTracked(ctx, ASK_JD_MESSAGE, {
      parse_mode: "HTML",
      reply_markup: cancelKeyboard,
    });
  });

  bot.callbackQuery("ranking", async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;

    const session = getSession(chatId);
    const results = session.results ?? [];
    await replyTracked(ctx, formatRankingMessage(results), {
      parse_mode: "HTML",
      reply_markup: afterResultKeyboard(results.length),
      link_preview_options: { is_disabled: true },
    });
  });

  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const session = getSession(chatId);
    const text = ctx.message.text.trim();

    if (text.startsWith("/")) {
      return;
    }

    if (session.step === "awaiting_jd") {
      if (isHttpUrl(text)) {
        const status = await ctx.reply("Mengambil JD dari link...");
        trackId(chatId, status.message_id);
        try {
          const jdText = await fetchJdFromUrl(text);
          setStep(chatId, "awaiting_cv", jdText, { type: "linked_post", url: text });
          await ctx.api.editMessageText(
            chatId,
            status.message_id,
            [
              "<b>JD dari link tersimpan.</b>",
              `Sumber: ${escapeHtml(text)}`,
              "",
              "Lanjut Step 2/2 — kirim CV kandidat sebagai file <b>PDF</b>.",
              "",
              "<i>Privacy: CV diproses di memori, tidak disimpan.</i>",
            ].join("\n"),
            {
              parse_mode: "HTML",
              reply_markup: cancelKeyboard,
            },
          );
        } catch (error) {
          const reason =
            error instanceof JdFetchError
              ? error.message
              : "Tidak bisa membaca link ini.";
          await ctx.api.editMessageText(
            chatId,
            status.message_id,
            [
              `<b>Gagal membaca link</b>`,
              escapeHtml(reason),
              "",
              "Paste teks JD manual (Requirements / Qualifications), atau kirim link career page publik lain.",
            ].join("\n"),
            {
              parse_mode: "HTML",
              reply_markup: cancelKeyboard,
            },
          );
        }
        return;
      }

      if (!isLikelyJdText(text)) {
        await replyInvalidJd(ctx);
        return;
      }

      setStep(chatId, "awaiting_cv", text, { type: "pasted" });
      await replyTracked(ctx, ASK_CV_MESSAGE, {
        parse_mode: "HTML",
        reply_markup: cancelKeyboard,
      });
      return;
    }

    if (session.step === "awaiting_cv") {
      await replyAskCvPdfOnly(ctx);
      return;
    }

    await replyIdleHint(ctx);
  });

  bot.on(
    [
      "message:photo",
      "message:sticker",
      "message:voice",
      "message:video",
      "message:animation",
      "message:video_note",
      "message:audio",
    ],
    async (ctx) => {
      const chatId = ctx.chat.id;
      const session = getSession(chatId);

      if (session.step === "awaiting_cv") {
        await replyAskCvPdfOnly(ctx);
        return;
      }

      if (session.step === "awaiting_jd") {
        await replyInvalidJd(ctx);
        return;
      }

      await replyIdleHint(ctx);
    },
  );

  bot.on("message:document", async (ctx) => {
    const chatId = ctx.chat.id;
    const session = getSession(chatId);

    if (session.step === "awaiting_jd") {
      await replyInvalidJd(ctx);
      return;
    }

    if (session.step !== "awaiting_cv" || !session.jdText) {
      await replyIdleHint(ctx);
      return;
    }

    if (!isPdfDocument(ctx)) {
      await replyAskCvPdfOnly(ctx);
      return;
    }

    const fileId = ctx.message.document.file_id;
    const fileUniqueId = ctx.message.document.file_unique_id;
    const fileName = ctx.message.document.file_name?.trim() || "CV";
    const status = await ctx.reply("Memproses CV...");
    trackId(chatId, status.message_id);
    let cvBuffer: Buffer | undefined;

    try {
      // Privacy: CV is processed in memory only — never written to disk.
      assertAllowedCvFileSize(ctx.message.document.file_size);
      const file = await ctx.getFile();
      if (!file.file_path) {
        throw new SecurePdfError("Tidak bisa mengakses file CV.");
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      cvBuffer = await downloadTelegramFileCapped(fileUrl);
      const cvText = await extractTextFromPdf(cvBuffer);
      wipeBuffer(cvBuffer);
      cvBuffer = undefined;

      if (!cvText) {
        await ctx.api.editMessageText(
          chatId,
          status.message_id,
          "Tidak ada teks yang bisa dibaca dari PDF ini (mungkin hasil scan/gambar).\nOCR belum didukung di MVP. Coba PDF berbasis teks.",
          { reply_markup: cancelKeyboard },
        );
        return;
      }

      const result = scoreCvAgainstJd(session.jdText, cvText);
      const explanation = await explainScore(result, {
        jdText: session.jdText,
        cvText,
        onError: (reason) => console.warn("AI explanation unavailable", { reason }),
      });
      addScreenedResult(chatId, { fileName, score: result.score });
      keepJdAwaitingCv(chatId);
      const resultCount = getSession(chatId).results?.length ?? 0;

      await ctx.api.editMessageText(
        chatId,
        status.message_id,
        formatScoreMessage(result, fileName, explanation),
        {
          parse_mode: "HTML",
          reply_markup: afterResultKeyboard(resultCount),
          link_preview_options: { is_disabled: true },
        },
      );
    } catch (error) {
      if (cvBuffer) {
        wipeBuffer(cvBuffer);
        cvBuffer = undefined;
      }

      const userMessage =
        error instanceof SecurePdfError
          ? error.message
          : "Gagal memproses PDF. Coba file lain, atau batalkan lalu screen ulang.";

      // Never log file contents, paths with token, or raw buffers.
      console.error("Failed to process CV", {
        errorName: error instanceof Error ? error.name : "unknown",
      });

      try {
        await ctx.api.editMessageText(chatId, status.message_id, userMessage, {
          reply_markup: mainKeyboard,
        });
      } catch {
        await replyTracked(ctx, userMessage, { reply_markup: mainKeyboard });
      }
    }
  });

  bot.catch((err) => {
    console.error("Bot error", {
      errorName: err.error instanceof Error ? err.error.name : "unknown",
    });
  });

  return bot;
}
