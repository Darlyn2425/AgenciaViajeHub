const crypto = require("node:crypto");

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function readRequestBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartFile(bodyBuffer, contentType) {
  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
  if (!boundaryMatch) throw new Error("Missing multipart boundary");

  const boundary = `--${boundaryMatch[1]}`;
  const raw = bodyBuffer.toString("latin1");
  const parts = raw.split(boundary).slice(1, -1);

  for (const part of parts) {
    const normalized = part.startsWith("\r\n") ? part.slice(2) : part;
    const headerEnd = normalized.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;

    const headerText = normalized.slice(0, headerEnd);
    let bodyText = normalized.slice(headerEnd + 4);
    if (bodyText.endsWith("\r\n")) bodyText = bodyText.slice(0, -2);

    const dispositionMatch = headerText.match(/content-disposition:\s*form-data;([^\n]+)/i);
    if (!dispositionMatch) continue;

    const filenameMatch = dispositionMatch[1].match(/filename="([^"]*)"/i);
    if (!filenameMatch || !filenameMatch[1]) continue;

    const typeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
    const mimeType = (typeMatch ? typeMatch[1] : "application/octet-stream").trim().toLowerCase();

    return {
      filename: filenameMatch[1],
      mimeType,
      buffer: Buffer.from(bodyText, "latin1"),
    };
  }

  throw new Error("File field 'file' is required");
}

function sanitizeFilename(input) {
  const clean = String(input || "image")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return clean || "image";
}

function buildBlobPath(filename) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = crypto.randomUUID();
  return `uploads/${yyyy}/${mm}/${id}-${sanitizeFilename(filename)}`;
}

module.exports = {
  ALLOWED_TYPES,
  readRequestBuffer,
  parseMultipartFile,
  buildBlobPath,
};
