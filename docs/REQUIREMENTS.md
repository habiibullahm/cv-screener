# CV Screener — Requirements (MVP)

## Goal

Tool Telegram untuk **HR / hiring manager** mengecek kecocokan kasar antara satu job posting (JD) dan satu atau lebih CV kandidat (PDF), mirip filter keyword ATS sederhana. Mendukung sticky JD, multi-CV di session yang sama, dan ranking in-memory.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Bot merespons `/start` dengan instruksi pemakaian (HR voice) |
| FR-02 | `/screen` memulai flow fresh (JD baru) dan meminta JD |
| FR-03 | Bot menerima JD sebagai plain text atau link career page publik |
| FR-04 | Setelah JD, bot meminta CV kandidat PDF |
| FR-05 | Bot menolak dokumen non-PDF dengan pesan jelas |
| FR-06 | Bot mengekstrak teks dari PDF |
| FR-07 | Jika teks PDF kosong, bot memberitahu OCR tidak didukung |
| FR-08 | Bot menghitung skor keyword overlap JD vs CV |
| FR-09 | Balasan berisi score %, band label HR, matched (max 15), missing (max 15), tip HR |
| FR-10 | `/cancel` menghapus session chat |
| FR-11 | Setelah skor, JD tetap aktif; **Upload CV lain** tanpa paste JD ulang |
| FR-12 | **Ganti JD** mengosongkan ranking session dan meminta JD baru |
| FR-13 | Session menyimpan hasil ringan (fileName + score) di memori (max 20) |
| FR-14 | **Lihat ranking** menampilkan urutan skor (top 10) jika ≥2 CV di-screen |
| FR-15 | `/done` / **Selesai** menutup session dengan pesan thank-you hiring-oriented |

## Non-functional requirements

- Node.js 20+, TypeScript, grammy, long polling
- Deterministic rule-based scoring is the source of truth; optional AI explanation cannot change it
- Optional PostgreSQL persistence for user-owned saved JD templates; active CV screening session remains in-memory per `chatId` and expires after one hour
- Secrets via `.env` (`BOT_TOKEN`), never committed
- Local-first MVP (no webhook deploy required)
- CV PDF processed in memory only (not written to disk)

## Out of scope

- AI explanation that changes score or requirements
- Full ATS (pipeline, notes, team seats)
- Persistent history / export CSV
- DOCX / image OCR
- Web app UI / multi-CV ranking dashboard di luar Telegram
- Batch zip upload
- Production webhook hosting (opsional di luar MVP)

## Acceptance criteria

1. `/start`, `/screen`, `/cancel`, `/done` berfungsi di `@cv_screener_bot`
2. Flow paste JD + upload PDF mengembalikan match score dengan tip HR
3. Upload CV kedua memakai JD yang sama tanpa paste ulang
4. Ranking muncul setelah ≥2 CV dan diurutkan score descending
5. Non-PDF dan PDF tanpa teks ditolak dengan pesan jelas
6. Token tidak masuk git (`.env` di `.gitignore`)
