const { getTenantIdFromRequest } = require("./tenant");
const { getBearerToken, verifyAuthToken, signAuthToken, getTokenTtl } = require("./auth-token");
const { getSession, hasPermission } = require("./auth-store");

function unauthorized(message) {
  const err = new Error(message || "Unauthorized");
  err.statusCode = 401;
  return err;
}

async function resolveSessionFromRequest(req) {
  const tenantId = getTenantIdFromRequest(req);
  const token = getBearerToken(req);
  if (!token) throw unauthorized("Missing auth token");

  let decoded;
  try {
    decoded = verifyAuthToken(token);
  } catch (error) {
    if (error?.name === "TokenExpiredError") throw unauthorized("Auth token expired");
    throw unauthorized("Invalid auth token");
  }

  const userId = String(decoded?.sub || "").trim();
  if (!userId) throw unauthorized("Invalid auth token subject");

  const session = await getSession(tenantId, userId);
  if (!session?.user || session.user.active === false) throw unauthorized("User not found or inactive");

  const refreshedToken = signAuthToken({
    tenantId,
    userId: session.user.id,
    username: session.user.username,
    roleId: session.user.roleId,
  });

  return {
    tenantId,
    user: session.user,
    roles: session.roles || [],
    token: refreshedToken,
    expiresIn: getTokenTtl(),
    can(permission) {
      return hasPermission(session.roles || [], session.user.roleId, permission);
    },
  };
}

module.exports = {
  resolveSessionFromRequest,
};
