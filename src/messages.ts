import { InlineKeyboard } from "grammy";
import type { ScoreResult } from "./types.js";

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const mainKeyboard = new InlineKeyboard()
  .text("Mulai screening", "screen")
  .text("Bantuan", "help")
  .row()
  .text("Batal", "cancel");

export const afterResultKeyboard = new InlineKeyboard()
  .text("Screen lagi", "screen")
  .text("Batal", "cancel");

export const START_MESSAGE = [
  "<b>CV Screener</b>",
  "Bandingkan job description (JD) dengan CV PDF kamu.",
  "",
  "<b>Cara pakai</b>",
  "1. Ketuk <b>Mulai screening</b> atau /screen",
  "2. Paste JD (bagian Requirements / Qualifications)",
  "3. Upload CV dalam format PDF",
  "",
  "Hasilnya: skor match + keyword yang cocok / kurang.",
].join("\n");

export const HELP_MESSAGE = [
  "<b>Bantuan</b>",
  "",
  "/screen — mulai screening",
  "/cancel — batalkan session",
  "/help — bantuan singkat",
  "",
  "Tip: paste bagian Requirements saja biar skor lebih relevan.",
].join("\n");

export const ASK_JD_MESSAGE = [
  "<b>Step 1/2 — Job description</b>",
  "Kirim teks JD sekarang.",
  "",
  "Tip: cukup bagian <i>Requirements / Qualifications</i>.",
].join("\n");

export const ASK_CV_MESSAGE = [
  "<b>Step 2/2 — CV</b>",
  "JD tersimpan. Kirim CV sebagai file <b>PDF</b>.",
].join("\n");

export function formatScoreMessage(result: ScoreResult): string {
  if (result.totalKeywords === 0) {
    return [
      "<b>Hasil screening</b>",
      "Tidak ada keyword yang cukup dari JD.",
      "",
      "Coba paste bagian Requirements yang lebih spesifik, lalu screen lagi.",
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
  ].join("\n");
}
