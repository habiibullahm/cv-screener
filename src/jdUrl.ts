const FETCH_TIMEOUT_MS = 10_000;
const MIN_JD_CHARS = 80;
const MAX_JD_CHARS = 20_000;

const USER_AGENT =
  "Mozilla/5.0 (compatible; CVScreenerBot/0.1; +https://github.com/habiibullahm/cv-screener)";

export class JdFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JdFetchError";
  }
}

export function isHttpUrl(text: string): boolean {
  const trimmed = text.trim();
  if (/\s/.test(trimmed)) return false;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    });
}

function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|br|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeBasicEntities(withoutNoise)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchJdFromUrl(urlString: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(urlString.trim());
  } catch {
    throw new JdFetchError("Link tidak valid.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new JdFetchError("Hanya link http/https yang didukung.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new JdFetchError(`Gagal mengambil halaman (HTTP ${response.status}).`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new JdFetchError("Link bukan halaman HTML yang bisa dibaca.");
    }

    const html = await response.text();
    let text = htmlToText(html);

    if (text.length > MAX_JD_CHARS) {
      text = text.slice(0, MAX_JD_CHARS);
    }

    if (text.length < MIN_JD_CHARS) {
      throw new JdFetchError(
        "Teks JD dari link terlalu pendek atau terblokir (sering terjadi di LinkedIn/JobStreet).",
      );
    }

    return text;
  } catch (error) {
    if (error instanceof JdFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new JdFetchError("Timeout saat mengambil link. Coba lagi atau paste JD manual.");
    }
    throw new JdFetchError("Tidak bisa membaca link ini. Paste JD manual saja.");
  } finally {
    clearTimeout(timeout);
  }
}
