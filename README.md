# CV Screener (`@cv_screener_bot`)

Telegram bot untuk **HR / hiring manager**: bandingkan **job description (JD)** dengan **CV kandidat (PDF)** memakai deterministic keyword matching. Optional Groq OpenAI-compatible AI explanation hanya menjelaskan hasil; score tetap rule-based. Satu JD bisa dipakai untuk banyak CV, lalu lihat ranking di session.

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
GROQ_API_KEY=  # Create at https://console.groq.com/keys
GROQ_MODEL=openai/gpt-oss-20b
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TIMEOUT_MS=4000
```

3. Jalankan bot (polling lokal):

```bash
npm run dev
```

Biarkan terminal tetap terbuka. Bot hanya online selama process ini berjalan.

## Cara pakai di Telegram

1. Buka [@cv_screener_bot](https://t.me/cv_screener_bot)
2. Kirim `/start`
3. Kirim `/screen`
4. Paste teks JD **atau** kirim link job posting (career page publik)
5. Upload CV kandidat sebagai file **PDF**
6. Terima match score + keyword matched / missing + optional explanation
7. Opsional: **Upload CV lain** (JD sama), **Lihat ranking**, atau **Ganti JD**

Link yang biasanya bisa dibaca: Greenhouse, Lever, Ashby, halaman `/careers` perusahaan.  
LinkedIn/JobStreet sering gagal (login/anti-bot) — kalau begitu, paste JD manual.

Perintah lain:

- `/done` — selesai session
- `/clear` — hapus pesan bot + reset session
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
Screen CV kandidat vs job posting — skor match dalam hitungan detik.
```

**Description**
```text
CV Screener membantu HR membandingkan job description dengan CV kandidat (PDF), lalu memberi skor match + keyword yang cocok/kurang.

Cara pakai: /screen → paste JD → upload CV PDF → Upload CV lain (JD sama) atau lihat ranking.
```

**Commands** (atau biarkan bot set otomatis saat start)
```text
start - Mulai & cara pakai
screen - Mulai screening JD vs CV
done - Selesai session
clear - Hapus pesan bot + reset
cancel - Batalkan session
help - Bantuan singkat
```

Tambahkan Botpic (logo 512×512) lewat Edit Bot → Botpic.

## Security & privacy

### CV PDF
- Diproses **in-memory only** (tidak ditulis ke disk / `tmp`)
- Maksimal **5 MB**
- Validasi magic header `%PDF-`
- Download di-stream dengan size cap
- Buffer di-wipe setelah teks diekstrak
- Log error tanpa isi file / URL ber-token

### Job link fetch (anti-SSRF)
- Hanya `http` / `https`, port **80/443**
- Block hostname sensitif (`localhost`, metadata, `.local`)
- Block private / link-local / loopback IP (IPv4 + IPv6, termasuk IPv4-mapped seperti `::ffff:7f00:1`)
- DNS di-resolve dulu, lalu koneksi **di-pin ke IP yang sudah divalidasi** (mencegah DNS rebinding)
- Redirect diikuti manual (max 5), tiap hop di-validasi + di-pin ulang
- Body HTML dibatasi **1.5 MB**
- Tolak URL dengan username/password

### Secrets
- `BOT_TOKEN` hanya di `.env` (lokal) atau Railway Variables
- Jangan commit `.env`

## Catatan

- Hanya PDF berbasis teks. PDF hasil scan (gambar) belum didukung (tanpa OCR).
- Session tersimpan di memori; idle lebih dari 1 jam dihapus; restart bot menghapus session aktif.
- Di Railway, `BOT_TOKEN` diisi lewat Variables (tanpa file `.env`).


## Saved JD

Dengan `DATABASE_URL`, user dapat menyimpan JD aktif menggunakan `/savejd Nama JD`, termasuk JD yang diimpor dari linked post. Gunakan `/myjd` untuk memakai atau menghapus template. Snapshot JD disimpan per akun dan tidak berubah ketika halaman sumber berubah; CV tetap tidak dipersist.
