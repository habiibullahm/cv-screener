# CV Screener — Requirements (MVP)

## Goal

Tool Telegram pribadi untuk mengecek kecocokan kasar antara satu JD yang sedang open dan satu CV PDF, mirip filter keyword ATS sederhana.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Bot merespons `/start` dengan instruksi pemakaian |
| FR-02 | `/screen` memulai flow dan meminta JD |
| FR-03 | Bot menerima JD sebagai plain text |
| FR-04 | Setelah JD, bot meminta CV PDF |
| FR-05 | Bot menolak dokumen non-PDF dengan pesan jelas |
| FR-06 | Bot mengekstrak teks dari PDF |
| FR-07 | Jika teks PDF kosong, bot memberitahu OCR tidak didukung |
| FR-08 | Bot menghitung skor keyword overlap JD vs CV |
| FR-09 | Balasan berisi score %, matched (max 15), missing (max 15), tip singkat |
| FR-10 | `/cancel` menghapus session chat |

## Non-functional requirements

- Node.js 20+, TypeScript, grammy, long polling
- Rule-based scoring only (no AI / LLM)
- No database; in-memory session per `chatId`
- Secrets via `.env` (`BOT_TOKEN`), never committed
- Local-first MVP (no webhook deploy required)

## Out of scope

- AI scoring
- Job recommendation list dari CV
- DOCX / image OCR
- Multi-CV ranking dashboard
- Web app UI
- Production webhook hosting

## Acceptance criteria

1. `/start`, `/screen`, `/cancel` berfungsi di `@cv_screener_bot`
2. Flow paste JD + upload PDF mengembalikan match score
3. Non-PDF dan PDF tanpa teks ditolak dengan pesan jelas
4. Token tidak masuk git (`.env` di `.gitignore`)
