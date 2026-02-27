const { json, methodNotAllowed } = require("../../lib/http");
const { readJsonBody } = require("../../lib/request");
const { readPagination } = require("../../lib/security");
const { listClients, upsertClient, deleteClientById } = require("../../lib/clients-store");
const { getTenantIdFromRequest } = require("../../lib/tenant");

const EXPOSE_DETAILS = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production";

function getId(req) {
  const raw = req.query?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return String(id || "").trim();
}

module.exports = async function handler(req, res) {
  let tenantId = "";
  try {
    tenantId = getTenantIdFromRequest(req);
  } catch (error) {
    return json(req, res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const { page, limit, search } = readPagination(req, { page: 1, limit: 100, maxLimit: 100 });
      const result = await listClients({ tenantId, page, limit, search });
      return json(req, res, 200, { ok: true, tenantId, items: result.items, pagination: result.pagination });
    } catch (error) {
      return json(req, res, 500, {
        ok: false,
        error: "Failed to list clients",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  if (req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const item = await upsertClient(tenantId, payload);
      return json(req, res, 201, { ok: true, item });
    } catch (error) {
      const status = String(error?.message || "").includes("required") ? 400 : 500;
      return json(req, res, status, {
        ok: false,
        error: "Failed to save client",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const id = getId(req);
      if (!id) return json(req, res, 400, { ok: false, error: "Missing client id" });
      const deleted = await deleteClientById(tenantId, id);
      if (!deleted) return json(req, res, 404, { ok: false, error: "Client not found", deleted: false });
      return json(req, res, 200, { ok: true, deleted: true });
    } catch (error) {
      return json(req, res, 500, {
        ok: false,
        error: "Failed to delete client",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  return methodNotAllowed(req, res, ["GET", "POST", "DELETE"]);
};
