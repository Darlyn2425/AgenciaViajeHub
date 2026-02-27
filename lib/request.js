const { toPositiveInt } = require("./security");

const DEFAULT_MAX_JSON_BYTES = toPositiveInt(process.env.MAX_JSON_BODY_BYTES, 256 * 1024, {
  min: 1024,
  max: 5 * 1024 * 1024,
});

function ensureJsonContentType(req) {
  const contentType = String(req?.headers?.["content-type"] || "").toLowerCase();
  if (!contentType || contentType.startsWith("application/json")) return;
  throw new Error("Content-Type must be application/json");
}

async function readJsonBody(req, options = {}) {
  const maxBytes = toPositiveInt(options.maxBytes, DEFAULT_MAX_JSON_BYTES, {
    min: 1024,
    max: 5 * 1024 * 1024,
  });
  ensureJsonContentType(req);

  if (req && typeof req.body === "object" && req.body !== null) {
    return req.body;
  }
  if (req && typeof req.body === "string") {
    const rawFromBody = req.body.trim();
    if (!rawFromBody) return {};
    try {
      return JSON.parse(rawFromBody);
    } catch {
      throw new Error("Invalid JSON body");
    }
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw new Error("JSON payload too large");
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

module.exports = {
  readJsonBody,
};
