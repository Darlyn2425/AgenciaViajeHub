function isProduction() {
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
}

function parseAllowedOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRequestOrigin(req) {
  const origin = req?.headers?.origin;
  return typeof origin === "string" ? origin.trim() : "";
}

function isOriginAllowed(req) {
  const origin = getRequestOrigin(req);
  if (!origin) return true;
  const allowedOrigins = parseAllowedOrigins();
  if (!allowedOrigins.length) return true;
  return allowedOrigins.includes(origin);
}

function applyApiSecurityHeaders(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader("Cache-Control", "no-store");

  if (isProduction()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  const origin = getRequestOrigin(req);
  if (origin && isOriginAllowed(req)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "false");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-Id, x-tenant-id");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  }
}

function toPositiveInt(raw, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number.parseInt(String(raw || ""), 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function readPagination(req, defaults = {}) {
  const pageRaw = Array.isArray(req.query?.page) ? req.query.page[0] : req.query?.page;
  const limitRaw = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit;
  const searchRaw = Array.isArray(req.query?.search) ? req.query.search[0] : req.query?.search;

  return {
    page: toPositiveInt(pageRaw, defaults.page || 1, { min: 1, max: 100000 }),
    limit: toPositiveInt(limitRaw, defaults.limit || 20, { min: 1, max: defaults.maxLimit || 100 }),
    search: String(searchRaw || "").slice(0, 120),
  };
}

module.exports = {
  applyApiSecurityHeaders,
  isOriginAllowed,
  parseAllowedOrigins,
  readPagination,
  toPositiveInt,
};
