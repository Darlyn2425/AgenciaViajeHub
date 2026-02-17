const { json, methodNotAllowed } = require("../../lib/http");
const { readJsonBody } = require("../../lib/request");
const { listTrips, upsertTrip, deleteTripById } = require("../../lib/trips-store");
const { getTenantIdFromRequest } = require("../../lib/tenant");

const EXPOSE_DETAILS = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production";

function getId(req) {
  const raw = req.query?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return String(id || "").trim();
}

function getPagination(req) {
  const pageRaw = Array.isArray(req.query?.page) ? req.query.page[0] : req.query?.page;
  const limitRaw = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit;
  const searchRaw = Array.isArray(req.query?.search) ? req.query.search[0] : req.query?.search;
  return {
    page: Number(pageRaw) || 1,
    limit: Number(limitRaw) || 100,
    search: String(searchRaw || ""),
  };
}

module.exports = async function handler(req, res) {
  let tenantId = "";
  try {
    tenantId = getTenantIdFromRequest(req);
  } catch (error) {
    return json(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const { page, limit, search } = getPagination(req);
      const result = await listTrips({ tenantId, page, limit, search });
      return json(res, 200, { ok: true, tenantId, items: result.items, pagination: result.pagination });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        error: "Failed to list trips",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  if (req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const item = await upsertTrip(tenantId, payload);
      return json(res, 201, { ok: true, item });
    } catch (error) {
      const status = String(error?.message || "").includes("required") ? 400 : 500;
      return json(res, status, {
        ok: false,
        error: "Failed to save trip",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const id = getId(req);
      if (!id) return json(res, 400, { ok: false, error: "Missing trip id" });
      const deleted = await deleteTripById(tenantId, id);
      if (!deleted) return json(res, 404, { ok: false, error: "Trip not found", deleted: false });
      return json(res, 200, { ok: true, deleted: true });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        error: "Failed to delete trip",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
};
