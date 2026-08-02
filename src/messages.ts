import { InlineKeyboard } from "grammy";
import type { ScoreResult, ScreenedResult } from "./types.js";

export const BOT_USERNAME = "cv_screener_bot";
export const BOT_LINK = `https://t.me/${BOT_USERNAME}`;

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
].join("\n");

export const mainKeyboard = new InlineKeyboard()
  .text("Mulai screening", "screen")
  .text("Bantuan", "help")
  .row()
  .text("Clear chat", "clear");

export function afterResultKeyboard(resultCount: number): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("Upload CV lain", "next_cv")
    .text("Ganti JD", "change_jd")
    .row();

  if (resultCount >= 2) {
    keyboard.text("Lihat ranking", "ranking").text("Selesai", "done").row();
  } else {
    keyboard.text("Selesai", "done").row();
  }

  keyboard.text("Clear chat", "clear");
  return keyboard;
}

export const START_MESSAGE = [
  "Halo, HR! Selamat datang di <b>CV Screener</b>.",
  "Cek cocok tidaknya CV kandidat vs job posting — skor + keyword missing.",
  "",
  "Cara pakai: <b>Mulai screening</b> → paste JD → upload CV PDF.",
  "Satu JD bisa untuk banyak CV + ranking.",
  "",
  "<i>Ini first-pass filter, bukan keputusan final.</i>",
  BRANDING_FOOTER,
].join("\n");

export const HELP_MESSAGE = [
  "<b>Bantuan CV Screener</b>",
  "",
  "/screen — mulai screening (JD baru)",
  "/done — selesai memakai bot (thank you)",
  "/cancel — batalkan session",
  "/clear — hapus pesan bot + reset session",
  "/help — bantuan singkat",
  "",
  "Step 1: paste teks JD atau kirim link career page publik.",
  "LinkedIn/JobStreet sering terblokir — kalau gagal, paste JD manual.",
  "",
  "Setelah skor: <b>Upload CV lain</b> memakai JD yang sama, atau <b>Ganti JD</b>.",
  "Skor bersifat keyword overlap (rule-based), bukan AI.",
  "",
  "Privacy: CV PDF diproses di memori dan tidak disimpan ke server sebagai file.",
  BRANDING_FOOTER,
].join("\n");

export const ASK_JD_MESSAGE = [
  "<b>Step 1/2 — Job description</b>",
  "Paste teks JD <b>atau</b> kirim link job posting (career page publik).",
  "",
  "Tip: kalau paste teks, cukup bagian <i>Requirements / Qualifications</i>.",
].join("\n");

export const ASK_CV_MESSAGE = [
  "<b>Step 2/2 — CV kandidat</b>",
  "JD tersimpan. Kirim CV kandidat sebagai file <b>PDF</b>.",
  "",
  "<i>Privacy: CV diproses di memori, tidak disimpan.</i>",
].join("\n");

/** Soft prompt when HR screens another CV against the same JD. */
export const ASK_CV_NEXT_MESSAGE = [
  "<b>CV kandidat berikutnya</b>",
  "JD masih aktif. Kirim CV lain sebagai file <b>PDF</b>.",
  "",
  "<i>Privacy: CV diproses di memori, tidak disimpan.</i>",
].join("\n");

export const IDLE_HINT_MESSAGE = [
  "Halo, HR! Bot ini untuk screening <b>CV kandidat vs job posting</b>.",
  "Pesan tadi di luar alur — tidak masalah.",
  "",
  "Mulai: ketuk <b>Mulai screening</b> atau /screen",
  "Bantuan: ketuk <b>Bantuan</b> atau /help",
  BRANDING_FOOTER,
].join("\n");

export const INVALID_JD_MESSAGE = [
  "<b>Step 1/2 — Job description</b>",
  "Pesan ini belum terlihat seperti JD / job posting.",
  "",
  "Paste teks <i>Requirements / Qualifications</i>, atau kirim link career page publik (http/https).",
  "Kalau link gagal dibaca, paste JD manual saja — atau ketuk <b>Batal</b>.",
].join("\n");

export const ASK_CV_PDF_ONLY_MESSAGE = [
  "<b>Step 2/2 — CV kandidat</b>",
  "Kirim CV sebagai file <b>PDF</b> (bukan teks, foto, sticker, atau voice).",
  "",
  "Di Telegram: lampirkan file → pilih PDF, atau ketuk <b>Batal</b>.",
].join("\n");

export const CANCEL_MESSAGE = [
  "Session dibatalkan.",
  "Kalau mau coba lagi, ketuk <b>Mulai screening</b>.",
  "",
  "Thank you for using <b>CV Screener</b>.",
  "Semoga hiring-nya cepat dan ketemu kandidat yang pas.",
  BRANDING_FOOTER,
].join("\n");

export const DONE_MESSAGE = [
  "Thank you for using <b>CV Screener</b>!",
  "Semoga hiring-nya cepat dan ketemu kandidat yang pas.",
  BRANDING_FOOTER,
].join("\n");

export const CLEAR_MESSAGE = [
  "<b>Chat cleared</b>",
  "Pesan bot dihapus dan session di-reset.",
  "",
  "Pesan dari kamu tidak bisa dihapus bot — clear history di profil chat jika perlu.",
  BRANDING_FOOTER,
].join("\n");

function scoreBandLabel(score: number): string {
  if (score <= 39) return "Weak match — gap keyword besar; pertimbangkan skip atau screening ringan";
  if (score <= 69) return "Review — cocok sebagian; cek missing di interview";
  return "Strong interview — match kuat; tetap verifikasi missing penting";
}

export function formatScoreMessage(result: ScoreResult, fileName = "CV"): string {
  const fileLine = `File: <b>${escapeHtml(fileName)}</b>`;

  if (result.totalKeywords === 0) {
    return [
      "<b>Hasil screening</b>",
      fileLine,
      "Tidak ada keyword yang cukup dari JD.",
      "",
      "Coba paste bagian Requirements yang lebih spesifik, atau <b>Ganti JD</b>.",
      BRANDING_FOOTER,
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

  const tip =
    result.missing.length > 0
      ? "Tip HR: missing keywords bisa jadi pertanyaan interview — jangan anggap skor sebagai keputusan final."
      : "Tip HR: keyword JD sudah banyak yang match. Tetap verifikasi pengalaman di interview.";

  return [
    "<b>Hasil screening</b>",
    fileLine,
    `Score: <b>${result.score}%</b>`,
    `<i>${result.matched.length}/${result.totalKeywords} keywords dari JD</i>`,
    escapeHtml(scoreBandLabel(result.score)),
    "",
    "<b>Matched</b>",
    matched,
    "",
    "<b>Missing</b>",
    missing,
    "",
    tip,
    BRANDING_FOOTER,
  ].join("\n");
}

const RANKING_DISPLAY_LIMIT = 10;

export function formatRankingMessage(results: ScreenedResult[]): string {
  if (results.length === 0) {
    return [
      "<b>Ranking vs JD aktif</b>",
      "Belum ada CV yang di-screen di session ini.",
      BRANDING_FOOTER,
    ].join("\n");
  }

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const shown = sorted.slice(0, RANKING_DISPLAY_LIMIT);
  const lines = shown.map(
    (r, i) => `${i + 1}. ${escapeHtml(r.fileName)} — <b>${r.score}%</b>`,
  );
  const extra = sorted.length - shown.length;

  return [
    "<b>Ranking vs JD aktif</b>",
    ...lines,
    ...(extra > 0 ? [`… +${extra} lagi`] : []),
    "",
    "<i>Ini first-pass keyword filter, bukan keputusan hiring final.</i>",
    BRANDING_FOOTER,
  ].join("\n");
}
