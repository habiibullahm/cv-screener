import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { IncomingMessage } from "node:http";

const FETCH_TIMEOUT_MS = 10_000;
const MIN_JD_CHARS = 80;
const MAX_JD_CHARS = 20_000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;

const USER_AGENT =
  "Mozilla/5.0 (compatible; CVScreenerBot/0.1; +https://github.com/habiibullahm/cv-screener)";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
]);

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

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    value = (value << 8) + n;
  }
  return value >>> 0;
}

function inCidr(ip: string, base: string, prefix: number): boolean {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/** Normalize IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1) to dotted IPv4. */
export function mappedIpv4FromIpv6(ip: string): string | null {
  const normalized = ip.toLowerCase();
  const dotted = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];

  const hex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;

  const hi = Number.parseInt(hex[1], 16);
  const lo = Number.parseInt(hex[2], 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

export function isBlockedIp(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (net.isIPv4(normalized)) {
    return (
      inCidr(normalized, "0.0.0.0", 8) ||
      inCidr(normalized, "10.0.0.0", 8) ||
      inCidr(normalized, "127.0.0.0", 8) ||
      inCidr(normalized, "169.254.0.0", 16) ||
      inCidr(normalized, "172.16.0.0", 12) ||
      inCidr(normalized, "192.168.0.0", 16) ||
      inCidr(normalized, "100.64.0.0", 10) ||
      inCidr(normalized, "192.0.0.0", 24) ||
      inCidr(normalized, "192.0.2.0", 24) ||
      inCidr(normalized, "198.51.100.0", 24) ||
      inCidr(normalized, "203.0.113.0", 24) ||
      inCidr(normalized, "224.0.0.0", 4) ||
      inCidr(normalized, "240.0.0.0", 4)
    );
  }

  if (net.isIPv6(normalized)) {
    if (normalized === "::1" || normalized === "::") return true;

    const mapped = mappedIpv4FromIpv6(normalized);
    if (mapped) return isBlockedIp(mapped);

    // Unique local fc00::/7
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    // Link-local fe80::/10
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return true;
    }
    return false;
  }

  return true;
}

function assertAllowedPort(url: URL): void {
  const port = url.port
    ? Number(url.port)
    : url.protocol === "https:"
      ? 443
      : 80;
  if (port !== 80 && port !== 443) {
    throw new JdFetchError("Hanya port 80/443 yang diizinkan.");
  }
}

type SafeEndpoint = {
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
};

async function resolveSafeEndpoint(url: URL): Promise<SafeEndpoint> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new JdFetchError("Hanya link http/https yang didukung.");
  }
  if (url.username || url.password) {
    throw new JdFetchError("Link dengan username/password tidak diizinkan.");
  }
  assertAllowedPort(url);

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) {
    throw new JdFetchError("Link tidak valid.");
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new JdFetchError("Link tidak diizinkan untuk alasan keamanan.");
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new JdFetchError("Link tidak diizinkan untuk alasan keamanan.");
    }
    const family = net.isIPv6(hostname) ? 6 : 4;
    return { url, hostname, address: hostname, family };
  }

  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new JdFetchError("Tidak bisa resolve host dari link.");
  }

  const safe = records.filter((record) => !isBlockedIp(record.address));
  if (safe.length === 0) {
    throw new JdFetchError("Link tidak diizinkan untuk alasan keamanan.");
  }

  const preferred = safe.find((record) => record.family === 4) ?? safe[0];
  return {
    url,
    hostname,
    address: preferred.address,
    family: preferred.family === 6 ? 6 : 4,
  };
}

function readIncomingCapped(res: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const contentLength = res.headers["content-length"];
    if (contentLength) {
      const declared = Number(contentLength);
      if (Number.isFinite(declared) && declared > maxBytes) {
        res.resume();
        reject(new JdFetchError("Halaman terlalu besar untuk diproses."));
        return;
      }
    }

    const chunks: Buffer[] = [];
    let total = 0;

    res.on("data", (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > maxBytes) {
        res.destroy();
        reject(new JdFetchError("Halaman terlalu besar untuk diproses."));
        return;
      }
      chunks.push(chunk);
    });
    res.on("end", () => resolve(Buffer.concat(chunks)));
    res.on("error", reject);
  });
}

type PinnedResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  finalUrl: URL;
};

function pinnedRequest(endpoint: SafeEndpoint, signal: AbortSignal): Promise<PinnedResponse> {
  const { url, hostname, address, family } = endpoint;
  const lib = url.protocol === "https:" ? https : http;
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      return;
    }

    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: address,
        family,
        port,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Host: url.host,
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          Connection: "close",
        },
        servername: hostname,
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        readIncomingCapped(res, MAX_HTML_BYTES)
          .then((body) => {
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body,
              finalUrl: url,
            });
          })
          .catch(reject);
      },
    );

    const onAbort = () => {
      req.destroy(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    req.on("timeout", () => {
      req.destroy(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    });
    req.on("error", (error) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
    req.end();
  });
}

async function fetchWithPinnedRedirects(startUrl: URL, signal: AbortSignal): Promise<PinnedResponse> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const endpoint = await resolveSafeEndpoint(current);
    const response = await pinnedRequest(endpoint, signal);
    const status = response.status;

    if (status >= 300 && status < 400) {
      const locationHeader = response.headers.location;
      const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
      if (!location) {
        throw new JdFetchError("Redirect tidak valid dari halaman tujuan.");
      }

      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new JdFetchError("Redirect tidak valid dari halaman tujuan.");
      }
      current = next;
      continue;
    }

    return response;
  }

  throw new JdFetchError("Terlalu banyak redirect dari link.");
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchWithPinnedRedirects(url, controller.signal);

    if (response.status < 200 || response.status >= 300) {
      throw new JdFetchError(`Gagal mengambil halaman (HTTP ${response.status}).`);
    }

    const contentTypeHeader = response.headers["content-type"];
    const contentType = (Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0]
      : contentTypeHeader
    )?.toLowerCase() ?? "";

    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      throw new JdFetchError("Link bukan halaman HTML yang bisa dibaca.");
    }

    let text = htmlToText(response.body.toString("utf8"));
    response.body.fill(0);

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
