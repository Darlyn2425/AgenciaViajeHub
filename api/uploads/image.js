const { put } = require("@vercel/blob");
const { json, methodNotAllowed } = require("../../lib/http");
const { getTenantIdFromRequest } = require("../../lib/tenant");
const { applyApiSecurityHeaders, isOriginAllowed } = require("../../lib/security");
const {
  ALLOWED_TYPES,
  readRequestBuffer,
  parseMultipartFile,
  buildBlobPath,
} = require("../../lib/upload-image");

const MAX_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES || 5 * 1024 * 1024);
const IS_LOCAL_DEBUG = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production";

module.exports = async function handler(req, res) {
  if (!isOriginAllowed(req)) {
    return json(req, res, 403, { ok: false, error: "Origin not allowed" });
  }

  let tenantId = "";
  try {
    tenantId = getTenantIdFromRequest(req);
  } catch (error) {
    return json(req, res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
  }

  if (req.method === "OPTIONS") {
    applyApiSecurityHeaders(req, res);
    res.statusCode = 204;
    res.setHeader("Allow", "POST, OPTIONS");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST", "OPTIONS"]);
  }

  const blobToken = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();

  if (!blobToken) {
    return json(req, res, 500, {
      ok: false,
      error: "Missing BLOB_READ_WRITE_TOKEN",
    });
  }

  const contentType = String(req.headers["content-type"] || "");
  if (!/^multipart\/form-data/i.test(contentType)) {
    return json(req, res, 400, {
      ok: false,
      error: "Use multipart/form-data with field 'file'",
    });
  }

  try {
    const rawBody = await readRequestBuffer(req, MAX_UPLOAD_BYTES);
    const file = parseMultipartFile(rawBody, contentType);

    if (!ALLOWED_TYPES.has(file.mimeType)) {
      return json(req, res, 415, {
        ok: false,
        error: "Unsupported file type. Allowed: image/jpeg, image/png, image/webp, image/gif",
      });
    }

    if (file.buffer.length === 0) {
      return json(req, res, 400, {
        ok: false,
        error: "Empty file",
      });
    }
    const blob = await put(buildBlobPath(`${tenantId}-${file.filename}`), file.buffer, {
      access: "public",
      contentType: file.mimeType,
      token: blobToken,
      addRandomSuffix: false,
    });

    return json(req, res, 201, {
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
    return json(req, res, 500, {
      ok: false,
      error: "Upload failed",
      details: IS_LOCAL_DEBUG ? String(error && error.message || error) : undefined,
    });
  }
};
