const { getDb } = require("./mongo");

let ensuredIndexes = false;
const ITINERARIES_COLLECTION = process.env.MONGODB_COLLECTION_ITINERARIES || "Itinerarios";

function normalizeItineraryDoc(input) {
  const base = { ...(input || {}) };
  delete base._id;
  return base;
}

function buildSearchFilter(search) {
  const q = String(search || "").trim();
  if (!q) return {};
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return {
    $or: [
      { title: pattern },
      { tripName: pattern },
      { tripDisplay: pattern },
      { overview: pattern },
      { text: pattern },
    ],
  };
}

async function getItinerariesCollection() {
  const db = await getDb();
  const collection = db.collection(ITINERARIES_COLLECTION);

  if (!ensuredIndexes) {
    try {
      await collection.createIndex({ tenantId: 1, id: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ tenantId: 1, updatedAtISO: -1 });
    } catch (error) {
      if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[itineraries-store] Index creation warning:", error?.message || error);
      }
    }
    ensuredIndexes = true;
  }

  return collection;
}

async function listItineraries({ tenantId, page = 1, limit = 100, search = "" } = {}) {
  const collection = await getItinerariesCollection();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const safePage = Math.max(1, Number(page) || 1);
  const filter = { tenantId, ...buildSearchFilter(search) };
  const skip = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    collection.find(filter).sort({ updatedAtISO: -1, createdAtISO: -1 }).skip(skip).limit(safeLimit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    items: rows.map(normalizeItineraryDoc),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

async function upsertItinerary(tenantId, payload) {
  const nowIso = new Date().toISOString();
  const id = String(payload?.id || "").trim();
  if (!id) throw new Error("Itinerary id is required");

  const collection = await getItinerariesCollection();
  const existing = await collection.findOne({ tenantId, id });
  const doc = {
    ...normalizeItineraryDoc(payload),
    id,
    tenantId,
    createdAtISO: payload?.createdAtISO || existing?.createdAtISO || nowIso,
    updatedAtISO: nowIso,
  };

  await collection.updateOne({ tenantId, id }, { $set: doc }, { upsert: true });
  return doc;
}

async function deleteItineraryById(tenantId, id) {
  const collection = await getItinerariesCollection();
  const result = await collection.deleteOne({ tenantId, id });
  return result.deletedCount > 0;
}

module.exports = {
  listItineraries,
  upsertItinerary,
  deleteItineraryById,
};
