import { Bot, InlineKeyboard, type Context } from "grammy";
import { extractTextFromPdf } from "./pdf.js";
import {
  ASK_CV_MESSAGE,
  ASK_JD_MESSAGE,
  HELP_MESSAGE,
  START_MESSAGE,
  afterResultKeyboard,
  formatScoreMessage,
  mainKeyboard,
} from "./messages.js";
import { scoreCvAgainstJd } from "./scorer.js";
import { clearSession, getSession, setStep } from "./session.js";

const replyOpts = {
  parse_mode: "HTML" as const,
  reply_markup: mainKeyboard,
};

const cancelKeyboard = new InlineKeyboard().text("Batal", "cancel");

async function beginScreen(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  setStep(chatId, "awaiting_jd");
  await ctx.reply(ASK_JD_MESSAGE, {
    parse_mode: "HTML",
    reply_markup: cancelKeyboard,
  });
}

async function cancelScreen(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  clearSession(chatId);
  await ctx.reply("Session dibatalkan. Ketuk <b>Mulai screening</b> untuk mulai lagi.", {
    parse_mode: "HTML",
    reply_markup: mainKeyboard,
  });
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
    await ctx.reply(START_MESSAGE, replyOpts);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_MESSAGE, replyOpts);
  });

  bot.command("screen", async (ctx) => {
    await beginScreen(ctx);
  });

  bot.command("cancel", async (ctx) => {
    await cancelScreen(ctx);
  });

  bot.callbackQuery("screen", async (ctx) => {
    await ctx.answerCallbackQuery();
    await beginScreen(ctx);
  });

  bot.callbackQuery("help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(HELP_MESSAGE, replyOpts);
  });

  bot.callbackQuery("cancel", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Dibatalkan" });
    await cancelScreen(ctx);
  });

  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const session = getSession(chatId);
    const text = ctx.message.text.trim();

    if (text.startsWith("/")) {
      return;
    }

    if (session.step === "awaiting_jd") {
      if (text.length < 20) {
        await ctx.reply(
          "JD terlalu pendek. Paste requirements yang lebih lengkap, atau ketuk <b>Batal</b>.",
          {
            parse_mode: "HTML",
            reply_markup: mainKeyboard,
          },
        );
        return;
      }

      setStep(chatId, "awaiting_cv", text);
      await ctx.reply(ASK_CV_MESSAGE, {
        parse_mode: "HTML",
        reply_markup: cancelKeyboard,
      });
      return;
    }

    if (session.step === "awaiting_cv") {
      await ctx.reply("Kirim file CV <b>PDF</b> (bukan teks), atau ketuk <b>Batal</b>.", {
        parse_mode: "HTML",
        reply_markup: mainKeyboard,
      });
      return;
    }

    await ctx.reply("Ketuk <b>Mulai screening</b> untuk mulai.", replyOpts);
  });

  bot.on("message:document", async (ctx) => {
    const chatId = ctx.chat.id;
    const session = getSession(chatId);

    if (session.step !== "awaiting_cv" || !session.jdText) {
      await ctx.reply(
        "Mulai dengan <b>Mulai screening</b>, lalu kirim JD dulu sebelum upload CV.",
        replyOpts,
      );
      return;
    }

    if (!isPdfDocument(ctx)) {
      await ctx.reply("Hanya PDF yang didukung. Kirim ulang CV sebagai file <b>.pdf</b>.", {
        parse_mode: "HTML",
        reply_markup: mainKeyboard,
      });
      return;
    }

    const fileId = ctx.message.document.file_id;
    const status = await ctx.reply("Memproses CV...");

    try {
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error(`Failed to download file (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const cvText = await extractTextFromPdf(buffer);

      if (!cvText) {
        await ctx.api.editMessageText(
          chatId,
          status.message_id,
          "Tidak ada teks yang bisa dibaca dari PDF ini (mungkin hasil scan/gambar).\nOCR belum didukung di MVP. Coba PDF berbasis teks.",
        );
        return;
      }

      const result = scoreCvAgainstJd(session.jdText, cvText);
      clearSession(chatId);
      await ctx.api.editMessageText(chatId, status.message_id, formatScoreMessage(result), {
        parse_mode: "HTML",
        reply_markup: afterResultKeyboard,
      });
    } catch (error) {
      console.error("Failed to process CV", { chatId, fileId, error });
      try {
        await ctx.api.editMessageText(
          chatId,
          status.message_id,
          "Gagal memproses PDF. Coba file lain, atau batalkan lalu screen ulang.",
          { reply_markup: mainKeyboard },
        );
      } catch {
        await ctx.reply("Gagal memproses PDF. Coba file lain, atau batalkan lalu screen ulang.", {
          reply_markup: mainKeyboard,
        });
      }
    }
  });

  bot.catch((err) => {
    console.error("Bot error", err);
  });

  return bot;
}
