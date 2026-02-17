const { json, methodNotAllowed } = require("../../lib/http");
const { readJsonBody } = require("../../lib/request");
const { getSettingsByTenant, upsertSettingsByTenant } = require("../../lib/settings-store");
const { getTenantIdFromRequest } = require("../../lib/tenant");

const EXPOSE_DETAILS = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production";

module.exports = async function handler(req, res) {
  let tenantId = "";
  try {
    tenantId = getTenantIdFromRequest(req);
  } catch (error) {
    return json(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const found = await getSettingsByTenant(tenantId);
      return json(res, 200, { ok: true, tenantId, settings: found?.settings || {}, updatedAt: found?.updatedAt || "" });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        error: "Failed to get settings",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  if (req.method === "PUT") {
    try {
      const body = await readJsonBody(req);
      const settings = body?.settings;
      if (!settings || typeof settings !== "object") {
        return json(res, 400, { ok: false, error: "Missing settings object" });
      }
      const saved = await upsertSettingsByTenant(tenantId, settings);
      return json(res, 200, { ok: true, tenantId: saved.tenantId, settings: saved.settings, updatedAt: saved.updatedAt });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        error: "Failed to save settings",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  return methodNotAllowed(res, ["GET", "PUT"]);
};
