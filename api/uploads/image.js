const { put } = require("@vercel/blob");
const { json, methodNotAllowed } = require("../../lib/http");
const {
  ALLOWED_TYPES,
  readRequestBuffer,
  parseMultipartFile,
  buildBlobPath,
} = require("../../lib/upload-image");

const MAX_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES || 5 * 1024 * 1024);
const IS_LOCAL_DEBUG = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production";

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Allow", "POST, OPTIONS");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST", "OPTIONS"]);
  }

  const blobToken = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();

  if (!blobToken) {
    return json(res, 500, {
      ok: false,
      error: "Missing BLOB_READ_WRITE_TOKEN",
    });
  }

  const contentType = String(req.headers["content-type"] || "");
  if (!/^multipart\/form-data/i.test(contentType)) {
    return json(res, 400, {
      ok: false,
      error: "Use multipart/form-data with field 'file'",
    });
  }

  try {
    const rawBody = await readRequestBuffer(req, MAX_UPLOAD_BYTES);
    const file = parseMultipartFile(rawBody, contentType);

    if (!ALLOWED_TYPES.has(file.mimeType)) {
      return json(res, 415, {
        ok: false,
        error: "Unsupported file type. Allowed: image/jpeg, image/png, image/webp, image/gif",
      });
    }

    if (file.buffer.length === 0) {
      return json(res, 400, {
        ok: false,
        error: "Empty file",
      });
    }
    const blob = await put(buildBlobPath(file.filename), file.buffer, {
      access: "public",
      contentType: file.mimeType,
      token: blobToken,
      addRandomSuffix: false,
    });

    return json(res, 201, {
      ok: true,
      file: {
        url: blob.url,
        pathname: blob.pathname,
        contentType: file.mimeType,
        size: file.buffer.length,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (IS_LOCAL_DEBUG) {
      console.error("[uploads/image] Upload error:", error);
    }
    return json(res, 500, {
      ok: false,
      error: "Upload failed",
      details: IS_LOCAL_DEBUG ? String(error && error.message || error) : undefined,
    });
  }
};
