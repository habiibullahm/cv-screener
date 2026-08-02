# CV Screener (`@cv_screener_bot`)

Telegram bot MVP yang membandingkan **job description (JD)** dengan **CV PDF** memakai keyword matching (rule-based, tanpa AI).

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and paste token dari BotFather:

```bash
cp .env.example .env
```

Isi `.env`:

```env
BOT_TOKEN=your_telegram_bot_token_here
```

3. Jalankan bot (polling lokal):

```bash
npm run dev
```

Biarkan terminal tetap terbuka. Bot hanya online selama process ini berjalan.

## Cara pakai di Telegram

1. Buka `@cv_screener_bot`
2. Kirim `/start`
3. Kirim `/screen`
4. Paste teks JD (paling berguna bagian Requirements / Qualifications)
5. Upload CV sebagai file **PDF**
6. Terima match score + keyword matched / missing

Perintah lain:

- `/cancel` — batalkan session
- `/help` — bantuan singkat

## Deploy (Railway)

Bot memakai **long polling** (tidak perlu domain/webhook).

1. Push repo ini ke GitHub (jangan commit `.env`).
2. Di [railway.app](https://railway.app): **New Project** → **Deploy from GitHub repo** → pilih `cv-screener`.
3. Buka service → **Variables** → tambah:
   - `BOT_TOKEN` = token dari BotFather
4. Pastikan start command: `npm start` (default dari `package.json`).
5. Deploy, lalu cek **Logs** sampai muncul:
   `CV Screener bot @cv_screener_bot is running (polling).`
6. **Stop bot lokal** (`npm run dev`) supaya tidak ada dua poller sekaligus.

Kalau deploy gagal, cek logs untuk: token kosong, start command salah, atau install error.

## Profil bot di BotFather (opsional)

Di @BotFather → `/mybots` → CV Screener:

**About**
```text
Cek kecocokan CV vs job description dalam hitungan detik.
```

**Description**
```text
CV Screener membandingkan JD yang kamu paste dengan CV PDF, lalu memberi skor match + keyword yang cocok/kurang.

Cara pakai: /screen → paste JD → upload CV PDF.
```

**Commands** (atau biarkan bot set otomatis saat start)
```text
start - Mulai & cara pakai
screen - Bandingkan JD dengan CV
cancel - Batalkan session
help - Bantuan singkat
```

Tambahkan Botpic (logo 512×512) lewat Edit Bot → Botpic.

## Catatan

- Hanya PDF berbasis teks. PDF hasil scan (gambar) belum didukung (tanpa OCR).
- Session tersimpan di memori; restart bot menghapus session aktif.
- Jangan commit file `.env`.
- Di Railway, `BOT_TOKEN` diisi lewat Variables (tanpa file `.env`).
