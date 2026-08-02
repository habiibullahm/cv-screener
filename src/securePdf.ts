const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB

export class SecurePdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurePdfError";
  }
}

export function assertAllowedCvFileSize(fileSize: number | undefined): void {
  if (typeof fileSize === "number" && fileSize > MAX_CV_BYTES) {
    throw new SecurePdfError("CV terlalu besar. Maksimal 5 MB.");
  }
}

export function assertPdfMagic(buffer: Buffer): void {
  if (buffer.length < 5) {
    throw new SecurePdfError("File bukan PDF yang valid.");
  }
  const header = buffer.subarray(0, 5).toString("latin1");
  if (header !== "%PDF-") {
    throw new SecurePdfError("File bukan PDF yang valid.");
  }
}

export async function downloadTelegramFileCapped(
  fileUrl: string,
  maxBytes: number = MAX_CV_BYTES,
): Promise<Buffer> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new SecurePdfError(`Gagal mengunduh CV (HTTP ${response.status}).`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new SecurePdfError("CV terlalu besar. Maksimal 5 MB.");
    }
  }

  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new SecurePdfError("CV terlalu besar. Maksimal 5 MB.");
    }
    const buffer = Buffer.from(arrayBuffer);
    assertPdfMagic(buffer);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new SecurePdfError("CV terlalu besar. Maksimal 5 MB.");
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  assertPdfMagic(buffer);
  return buffer;
}

/** Best-effort wipe of sensitive CV bytes from a Buffer after processing. */
export function wipeBuffer(buffer: Buffer): void {
  buffer.fill(0);
}
