const jwt = require("jsonwebtoken");
const { json, methodNotAllowed } = require("../../lib/http");
const { readJsonBody } = require("../../lib/request");
const { normalizeTenantId } = require("../../lib/tenant");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || "";
    if (!jwtSecret) {
      return json(res, 500, { ok: false, error: "JWT secret is not configured" });
    }

    const body = await readJsonBody(req);
    const tenantId = normalizeTenantId(body?.tenantId);

    const username = String(body?.username || "").trim();
    const userId = String(body?.userId || username || "session").trim();
    const ttl = process.env.AUTH_TOKEN_TTL || "8h";
    const issuer = process.env.AUTH_TOKEN_ISSUER || "brianessa-travel-hub";

    const token = jwt.sign(
      {
        tenantId,
        username,
      },
      jwtSecret,
      {
        subject: userId,
        issuer,
        expiresIn: ttl,
      }
    );

    return json(res, 200, {
      ok: true,
      token,
      tokenType: "Bearer",
      expiresIn: ttl,
      tenantId,
    });
  } catch (error) {
    return json(res, 500, { ok: false, error: "Failed to issue auth token", details: String(error?.message || error) });
  }
};
