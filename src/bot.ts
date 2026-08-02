import { Bot, type Context } from "grammy";
import { extractTextFromPdf } from "./pdf.js";
import { formatScoreMessage, scoreCvAgainstJd } from "./scorer.js";
import { clearSession, getSession, setStep } from "./session.js";

const START_MESSAGE = [
  "CV Screener — bandingkan job description (JD) dengan CV PDF kamu.",
  "",
  "Cara pakai:",
  "1. /screen",
  "2. Paste JD (paling berguna bagian Requirements / Qualifications)",
  "3. Upload CV dalam format PDF",
  "",
  "Perintah:",
  "/screen — mulai screening",
  "/cancel — batalkan session",
  "/help — bantuan singkat",
].join("\n");

const HELP_MESSAGE = [
  "Kirim /screen untuk mulai.",
  "Lalu paste teks JD, kemudian upload CV PDF.",
  "Gunakan /cancel jika ingin mengulang dari awal.",
].join("\n");

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
    await ctx.reply(START_MESSAGE);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_MESSAGE);
  });

  bot.command("screen", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;

    setStep(chatId, "awaiting_jd");
    await ctx.reply(
      "Kirim job description (teks).\nTip: cukup bagian Requirements / Qualifications.",
    );
  });

  bot.command("cancel", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;

    clearSession(chatId);
    await ctx.reply("Session dibatalkan. Ketik /screen untuk mulai lagi.");
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
          "JD terlalu pendek. Paste requirements yang lebih lengkap, atau /cancel.",
        );
        return;
      }

      setStep(chatId, "awaiting_cv", text);
      await ctx.reply("JD tersimpan. Sekarang kirim CV dalam format PDF.");
      return;
    }

    if (session.step === "awaiting_cv") {
      await ctx.reply("Sekarang kirim file CV PDF (bukan teks). Atau /cancel.");
      return;
    }

    await ctx.reply("Ketik /screen untuk mulai screening CV vs JD.");
  });

  bot.on("message:document", async (ctx) => {
    const chatId = ctx.chat.id;
    const session = getSession(chatId);

    if (session.step !== "awaiting_cv" || !session.jdText) {
      await ctx.reply("Mulai dengan /screen, lalu kirim JD dulu sebelum upload CV.");
      return;
    }

    if (!isPdfDocument(ctx)) {
      await ctx.reply("Hanya PDF yang didukung. Kirim ulang CV sebagai file .pdf.");
      return;
    }

    const fileId = ctx.message.document.file_id;

    try {
      await ctx.reply("Memproses CV...");

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
        await ctx.reply(
          "Tidak ada teks yang bisa dibaca dari PDF ini (mungkin hasil scan/gambar).\nOCR belum didukung di MVP. Coba PDF berbasis teks.",
        );
        return;
      }

      const result = scoreCvAgainstJd(session.jdText, cvText);
      clearSession(chatId);
      await ctx.reply(formatScoreMessage(result));
    } catch (error) {
      console.error("Failed to process CV", { chatId, fileId, error });
      await ctx.reply(
        "Gagal memproses PDF. Coba file lain, atau /cancel lalu /screen ulang.",
      );
    }
  });

  bot.catch((err) => {
    console.error("Bot error", err);
  });

  return bot;
}
