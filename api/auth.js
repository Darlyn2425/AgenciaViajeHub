const { json, methodNotAllowed } = require("../lib/http");
const { readJsonBody } = require("../lib/request");
const { normalizeTenantId } = require("../lib/tenant");
const { verifyCredentials, updateMyProfile, listUsers, upsertUser, deleteUser, resetAccess } = require("../lib/auth-store");
const { signAuthToken, getTokenTtl } = require("../lib/auth-token");
const { resolveSessionFromRequest } = require("../lib/auth-session");
const { isOriginAllowed, applyApiSecurityHeaders } = require("../lib/security");

const EXPOSE_DETAILS = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production";

function routeFromRequest(req) {
  const q = Array.isArray(req.query?.route) ? req.query.route[0] : req.query?.route;
  return String(q || "").trim().toLowerCase();
}

function getUserId(req) {
  const raw = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  return String(raw || "").trim();
}

function optionsAllow(route) {
  if (route === "login") return ["POST", "OPTIONS"];
  if (route === "session") return ["GET", "OPTIONS"];
  if (route === "profile") return ["PUT", "OPTIONS"];
  if (route === "reset") return ["POST", "OPTIONS"];
  if (route === "users") return ["GET", "POST", "DELETE", "OPTIONS"];
  if (route === "token") return ["POST", "OPTIONS"];
  return ["OPTIONS"];
}

module.exports = async function handler(req, res) {
  if (!isOriginAllowed(req)) {
    return json(req, res, 403, { ok: false, error: "Origin not allowed" });
  }

  const route = routeFromRequest(req);
  const allow = optionsAllow(route);

  if (req.method === "OPTIONS") {
    applyApiSecurityHeaders(req, res);
    res.statusCode = 204;
    res.setHeader("Allow", allow.join(", "));
    res.end();
    return;
  }

  try {
    if (route === "login") {
      if (req.method !== "POST") return methodNotAllowed(req, res, allow);
      const body = await readJsonBody(req);
      const tenantId = normalizeTenantId(body?.tenantId || req.headers?.["x-tenant-id"] || req.query?.tenantId || "default");
      const auth = await verifyCredentials(tenantId, body?.username, body?.password);
      if (!auth.ok) return json(req, res, 401, { ok: false, error: auth.message || "Unauthorized" });

      const token = signAuthToken({
        tenantId,
        userId: auth.user.id,
        username: auth.user.username,
        roleId: auth.user.roleId,
      });
      return json(req, res, 200, {
        ok: true,
        tenantId,
        token,
        tokenType: "Bearer",
        expiresIn: getTokenTtl(),
        user: auth.user,
        roles: auth.roles || [],
      });
    }

    if (route === "session" || route === "token") {
      if ((route === "session" && req.method !== "GET") || (route === "token" && req.method !== "POST")) {
        return methodNotAllowed(req, res, allow);
      }
      const session = await resolveSessionFromRequest(req);
      return json(req, res, 200, {
        ok: true,
        tenantId: session.tenantId,
        token: session.token,
        tokenType: "Bearer",
        expiresIn: session.expiresIn,
        user: session.user,
        roles: session.roles,
      });
    }

    if (route === "profile") {
      if (req.method !== "PUT") return methodNotAllowed(req, res, allow);
      const session = await resolveSessionFromRequest(req);
      const body = await readJsonBody(req);
      const changed = await updateMyProfile(session.tenantId, session.user.id, {
        name: body?.name,
        email: body?.email,
        phone: body?.phone,
        newPassword: body?.newPassword,
      });
      if (!changed.ok) return json(req, res, 400, { ok: false, error: changed.message || "Invalid profile payload" });
      return json(req, res, 200, {
        ok: true,
        user: changed.user,
        token: session.token,
        tokenType: "Bearer",
        expiresIn: session.expiresIn,
        roles: session.roles,
      });
    }

    if (route === "reset") {
      if (req.method !== "POST") return methodNotAllowed(req, res, allow);
      const session = await resolveSessionFromRequest(req);
      if (!session.can("users.manage")) {
        return json(req, res, 403, { ok: false, error: "Forbidden" });
      }
      const result = await resetAccess(session.tenantId);
      return json(req, res, 200, { ok: true, username: result.username });
    }

    if (route === "users") {
      const session = await resolveSessionFromRequest(req);
      if (!session.can("users.manage")) {
        return json(req, res, 403, { ok: false, error: "Forbidden" });
      }

      if (req.method === "GET") {
        const found = await listUsers(session.tenantId);
        return json(req, res, 200, { ok: true, users: found.users, roles: found.roles });
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        const saved = await upsertUser(session.tenantId, body || {}, session.user.id);
        if (!saved.ok) return json(req, res, 400, { ok: false, error: saved.message || "Invalid user payload" });
        const found = await listUsers(session.tenantId);
        return json(req, res, 200, { ok: true, user: saved.user, users: found.users, roles: found.roles });
      }
      if (req.method === "DELETE") {
        const id = getUserId(req);
        if (!id) return json(req, res, 400, { ok: false, error: "Missing user id" });
        const removed = await deleteUser(session.tenantId, id, session.user.id);
        if (!removed.ok) return json(req, res, 400, { ok: false, error: removed.message || "Failed to remove user" });
        const found = await listUsers(session.tenantId);
        return json(req, res, 200, { ok: true, users: found.users, roles: found.roles });
      }
      return methodNotAllowed(req, res, allow);
    }

    return json(req, res, 404, { ok: false, error: "Auth route not found" });
  } catch (error) {
    return json(req, res, error?.statusCode || 500, {
      ok: false,
      error: error?.message || "Auth request failed",
      details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
    });
  }
};
