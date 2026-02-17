const { getDb } = require("./mongo");

let ensuredIndexes = false;
const QUOTATIONS_COLLECTION = process.env.MONGODB_COLLECTION_QUOTATIONS || "quotations";

function normalizeQuotationDoc(input) {
  const base = { ...(input || {}) };
  delete base._id;
  return base;
}

async function getQuotationsCollection() {
  const db = await getDb();
  const collection = db.collection(QUOTATIONS_COLLECTION);

  if (!ensuredIndexes) {
    try {
      // Migrate legacy unique index on id (global) to tenant-scoped unique index.
      const indexes = await collection.indexes().catch(() => []);
      const legacyGlobalId = indexes.find((idx) => idx?.name === "id_1" && idx?.unique);
      if (legacyGlobalId) {
        await collection.dropIndex("id_1").catch(() => null);
      }
      await collection.createIndex({ tenantId: 1, id: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ tenantId: 1, updatedAt: -1 });
    } catch (error) {
      // Do not block CRUD if index creation fails on existing legacy data.
      if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[quotations-store] Index creation warning:", error?.message || error);
      }
    }
    ensuredIndexes = true;
  }

  return collection;
}

function buildSearchFilter(search) {
  const q = String(search || "").trim();
  if (!q) return {};
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return {
    $or: [
      { destination: pattern },
      { clientName: pattern },
      { clientDisplay: pattern },
      { datesText: pattern },
      { statusLabel: pattern },
    ],
  };
}

async function listQuotations({ tenantId, page = 1, limit = 20, search = "" } = {}) {
  const collection = await getQuotationsCollection();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const filter = { tenantId, ...buildSearchFilter(search) };
  const skip = (safePage - 1) * safeLimit;
  const [rows, total] = await Promise.all([
    collection.find(filter).sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(safeLimit).toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    items: rows.map(normalizeQuotationDoc),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

async function getQuotationById(tenantId, id) {
  const collection = await getQuotationsCollection();
  const row = await collection.findOne({ id, tenantId });
  return row ? normalizeQuotationDoc(row) : null;
}

async function upsertQuotation(tenantId, payload) {
  const now = new Date().toISOString();
  const id = String(payload?.id || "").trim();
  if (!id) {
    throw new Error("Quotation id is required");
  }

  const collection = await getQuotationsCollection();
  const existing = await collection.findOne({ id, tenantId });
  const incomingHasImages = Object.prototype.hasOwnProperty.call(payload || {}, "images");
  const incomingHasItineraryDays = Object.prototype.hasOwnProperty.call(payload || {}, "itineraryDays");
  const doc = {
    ...normalizeQuotationDoc(existing || {}),
    ...normalizeQuotationDoc(payload),
    id,
    tenantId,
    createdAt: payload?.createdAt || existing?.createdAt || now,
    updatedAt: now,
  };
  if (!incomingHasImages && Array.isArray(existing?.images)) {
    doc.images = existing.images;
  }
  if (!incomingHasItineraryDays && Array.isArray(existing?.itineraryDays)) {
    doc.itineraryDays = existing.itineraryDays;
  }

  await collection.updateOne({ id, tenantId }, { $set: doc }, { upsert: true });
  return doc;
}

async function deleteQuotationById(tenantId, id) {
  const collection = await getQuotationsCollection();
  const result = await collection.deleteOne({ id, tenantId });
  return result.deletedCount > 0;
}

module.exports = {
  listQuotations,
  getQuotationById,
  upsertQuotation,
  deleteQuotationById,
};
