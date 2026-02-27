const jwt = require("jsonwebtoken");

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || "";
}

function getIssuer() {
  return process.env.AUTH_TOKEN_ISSUER || "brianessa-travel-hub";
}

function getAudience() {
  return String(process.env.AUTH_TOKEN_AUDIENCE || "").trim();
}

function getTokenTtl() {
  return process.env.AUTH_TOKEN_TTL || "8h";
}

function getBearerToken(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || "";
  if (typeof authHeader !== "string") return "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function signAuthToken({ tenantId, userId, username, roleId }) {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) throw new Error("JWT secret is not configured");
  return jwt.sign(
    { tenantId, username, roleId },
    jwtSecret,
    {
      algorithm: "HS256",
      subject: String(userId || ""),
      issuer: getIssuer(),
      ...(getAudience() ? { audience: getAudience() } : {}),
      expiresIn: getTokenTtl(),
    }
  );
}

function verifyAuthToken(token) {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) throw new Error("JWT secret is not configured");
  const verifyOptions = {
    algorithms: ["HS256"],
    issuer: getIssuer(),
  };
  if (getAudience()) verifyOptions.audience = getAudience();
  return jwt.verify(token, jwtSecret, verifyOptions);
}

module.exports = {
  getBearerToken,
  getTokenTtl,
  signAuthToken,
  verifyAuthToken,
};
