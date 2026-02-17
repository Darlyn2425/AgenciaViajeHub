const { json, methodNotAllowed } = require("../../lib/http");
const { readJsonBody } = require("../../lib/request");
const { getQuotationById, upsertQuotation, deleteQuotationById } = require("../../lib/quotations-store");
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
    return json(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
  }
  const id = getId(req);
  if (!id) {
    return json(res, 400, { ok: false, error: "Missing quotation id" });
  }

  if (req.method === "GET") {
    try {
      const item = await getQuotationById(tenantId, id);
      if (!item) return json(res, 404, { ok: false, error: "Quotation not found" });
      return json(res, 200, { ok: true, item });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        error: "Failed to get quotation",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  if (req.method === "PUT") {
    try {
      const payload = await readJsonBody(req);
      const item = await upsertQuotation(tenantId, { ...payload, id });
      return json(res, 200, { ok: true, item });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        error: "Failed to update quotation",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const deleted = await deleteQuotationById(tenantId, id);
      if (!deleted) {
        return json(res, 404, { ok: false, error: "Quotation not found", deleted: false });
      }
      return json(res, 200, { ok: true, deleted });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        error: "Failed to delete quotation",
        details: EXPOSE_DETAILS ? String(error?.message || error) : undefined,
      });
    }
  }

  return methodNotAllowed(res, ["GET", "PUT", "DELETE"]);
};
