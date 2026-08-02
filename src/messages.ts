import { InlineKeyboard } from "grammy";
import type { ScoreResult } from "./types.js";

export const BOT_USERNAME = "cv_screener_bot";
export const BOT_LINK = `https://t.me/${BOT_USERNAME}`;

const SHARE_TEXT =
  "Coba CV Screener — bandingkan CV PDF dengan job description secara cepat.";

/** Opens Telegram's native share picker (not just open the bot chat). */
export const BOT_SHARE_LINK =
  `https://t.me/share/url?url=${encodeURIComponent(BOT_LINK)}` +
  `&text=${encodeURIComponent(SHARE_TEXT)}`;

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const BRANDING_FOOTER = [
  "",
  "—",
  `<b>CV Screener</b> · <a href="${BOT_LINK}">@${BOT_USERNAME}</a>`,
  `Share: <a href="${BOT_SHARE_LINK}">bagikan bot ini</a>`,
].join("\n");

export const mainKeyboard = new InlineKeyboard()
  .text("Mulai screening", "screen")
  .text("Bantuan", "help")
  .row()
  .text("Batal", "cancel")
  .url("Bagikan bot", BOT_SHARE_LINK);

export const afterResultKeyboard = new InlineKeyboard()
  .text("Screen lagi", "screen")
  .text("Selesai", "done")
  .row()
  .url("Bagikan bot", BOT_SHARE_LINK);

export const START_MESSAGE = [
  "Halo! Selamat datang di <b>CV Screener</b>.",
  "Siap bantu cek seberapa cocok CV kamu dengan job description.",
  "",
  "<b>Cara pakai</b>",
  "1. Ketuk <b>Mulai screening</b> atau /screen",
  "2. Paste JD <b>atau</b> kirim link lowongan (career page publik)",
  "3. Upload CV dalam format PDF",
  "",
  "Hasilnya: skor match + keyword yang cocok / kurang.",
  BRANDING_FOOTER,
].join("\n");

export const HELP_MESSAGE = [
  "<b>Bantuan CV Screener</b>",
  "",
  "/screen — mulai screening",
  "/done — selesai memakai bot (thank you)",
  "/cancel — batalkan session",
  "/help — bantuan singkat",
  "",
  "Step 1 bisa paste teks JD atau kirim link career page publik.",
  "LinkedIn/JobStreet sering terblokir — kalau gagal, paste JD manual.",
  BRANDING_FOOTER,
].join("\n");

export const ASK_JD_MESSAGE = [
  "<b>Step 1/2 — Job description</b>",
  "Paste teks JD <b>atau</b> kirim link lowongan (career page publik).",
  "",
  "Contoh link yang biasanya bisa dibaca: Greenhouse, Lever, Ashby, /careers perusahaan.",
  "Tip: kalau paste teks, cukup bagian <i>Requirements / Qualifications</i>.",
].join("\n");

export const ASK_CV_MESSAGE = [
  "<b>Step 2/2 — CV</b>",
  "JD tersimpan. Kirim CV sebagai file <b>PDF</b>.",
].join("\n");

export const IDLE_HINT_MESSAGE = [
  "Halo! Bot ini khusus untuk <b>screening CV vs job description</b>.",
  "Pesan tadi di luar alur screening — tidak masalah.",
  "",
  "Untuk mulai: ketuk <b>Mulai screening</b> atau kirim /screen",
  "Butuh panduan? Ketuk <b>Bantuan</b> atau /help",
  BRANDING_FOOTER,
].join("\n");

export const INVALID_JD_MESSAGE = [
  "<b>Step 1/2 — Job description</b>",
  "Pesan ini belum terlihat seperti JD.",
  "",
  "Paste teks <i>Requirements / Qualifications</i>, atau kirim link career page publik (http/https).",
  "Kalau link gagal dibaca, paste JD manual saja — atau ketuk <b>Batal</b>.",
].join("\n");

export const ASK_CV_PDF_ONLY_MESSAGE = [
  "<b>Step 2/2 — CV</b>",
  "Kirim CV sebagai file <b>PDF</b> (bukan teks, foto, sticker, atau voice).",
  "",
  "Di Telegram: lampirkan file → pilih PDF, atau ketuk <b>Batal</b>.",
].join("\n");

export const CANCEL_MESSAGE = [
  "Session dibatalkan.",
  "Kalau mau coba lagi, ketuk <b>Mulai screening</b>.",
  "",
  "Thank you for using <b>CV Screener</b>.",
  "Semoga segera ketemu role yang pas.",
  BRANDING_FOOTER,
].join("\n");

export const DONE_MESSAGE = [
  "<b>Done using CV Screener</b>",
  "Screening session sudah selesai.",
  "",
  "Thank you for using <b>CV Screener</b>!",
  "Semoga apply-nya lancar dan segera dapat kabar baik.",
  BRANDING_FOOTER,
].join("\n");

const CLOSING_BLOCK = [
  "",
  "<b>Done using CV Screener</b>",
  "Thank you for using <b>CV Screener</b>!",
  "Semoga apply-nya lancar.",
  BRANDING_FOOTER,
].join("\n");

export function formatScoreMessage(result: ScoreResult): string {
  if (result.totalKeywords === 0) {
    return [
      "<b>Hasil screening</b>",
      "Tidak ada keyword yang cukup dari JD.",
      "",
      "Coba paste bagian Requirements yang lebih spesifik, lalu screen lagi.",
      CLOSING_BLOCK,
    ].join("\n");
  }

  const matched =
    result.matched.length > 0
      ? result.matched.map((k) => `• ${escapeHtml(k)}`).join("\n")
      : "• (tidak ada)";
  const missing =
    result.missing.length > 0
      ? result.missing.map((k) => `• ${escapeHtml(k)}`).join("\n")
      : "• (tidak ada)";

  return [
    "<b>Hasil screening</b>",
    `Score: <b>${result.score}%</b>`,
    `<i>${result.matched.length}/${result.totalKeywords} keywords dari JD</i>`,
    "",
    "<b>Matched</b>",
    matched,
    "",
    "<b>Missing</b>",
    missing,
    "",
    "Tip: tambahkan keyword yang missing di CV (jika relevan), lalu screen lagi.",
    CLOSING_BLOCK,
  ].join("\n");
}
