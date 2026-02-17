const jwt = require("jsonwebtoken");

function normalizeTenantId(raw) {
  const value = String(raw || "").trim();
  if (!value) return "default";
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return safe || "default";
}

function getBearerToken(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || "";
  if (typeof authHeader !== "string") return "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function unauthorized(message) {
  const err = new Error(message || "Unauthorized");
  err.statusCode = 401;
  return err;
}

function serverError(message) {
  const err = new Error(message || "Server error");
  err.statusCode = 500;
  return err;
}

function getTenantIdFromRequest(req) {
  const strictFromEnv = String(process.env.REQUIRE_AUTH_TENANT || "").toLowerCase();
  const strictMode = !["0", "false", "no", "off"].includes(strictFromEnv);

  const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || "";
  if (strictMode && !jwtSecret) {
    throw serverError("JWT secret is not configured");
  }

  const token = getBearerToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret);
      const tokenTenant = normalizeTenantId(decoded?.tenantId || decoded?.tid || "");
      if (!tokenTenant) throw unauthorized("Token without tenantId");
      return tokenTenant;
    } catch (error) {
      if (error?.name === "TokenExpiredError") throw unauthorized("Auth token expired");
      if (strictMode) throw unauthorized("Invalid auth token");
    }
  } else if (strictMode) {
    throw unauthorized("Missing auth token");
  }

  const byQuery = Array.isArray(req.query?.tenantId) ? req.query.tenantId[0] : req.query?.tenantId;
  const byHeader = req.headers?.["x-tenant-id"] || req.headers?.["X-Tenant-Id"];
  return normalizeTenantId(byQuery || byHeader || "default");
}

module.exports = {
  normalizeTenantId,
  getTenantIdFromRequest,
};
