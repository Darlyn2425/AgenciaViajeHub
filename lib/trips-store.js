const { getDb } = require("./mongo");

let ensuredIndexes = false;
const TRIPS_COLLECTION = process.env.MONGODB_COLLECTION_TRIPS || "Viajes";

function normalizeTripDoc(input) {
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
      { name: pattern },
      { destination: pattern },
      { status: pattern },
      { startDate: pattern },
      { endDate: pattern },
    ],
  };
}

async function getTripsCollection() {
  const db = await getDb();
  const collection = db.collection(TRIPS_COLLECTION);

  if (!ensuredIndexes) {
    try {
      await collection.createIndex({ tenantId: 1, id: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ tenantId: 1, updatedAtISO: -1 });
    } catch (error) {
      if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[trips-store] Index creation warning:", error?.message || error);
      }
    }
    ensuredIndexes = true;
  }

  return collection;
}

async function listTrips({ tenantId, page = 1, limit = 100, search = "" } = {}) {
  const collection = await getTripsCollection();
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const safePage = Math.max(1, Number(page) || 1);
  const filter = { tenantId, ...buildSearchFilter(search) };
  const skip = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    collection.find(filter).sort({ updatedAtISO: -1, createdAtISO: -1 }).skip(skip).limit(safeLimit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    items: rows.map(normalizeTripDoc),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

async function upsertTrip(tenantId, payload) {
  const nowIso = new Date().toISOString();
  const id = String(payload?.id || "").trim();
  if (!id) throw new Error("Trip id is required");

  const collection = await getTripsCollection();
  const existing = await collection.findOne({ tenantId, id });
  const doc = {
    ...normalizeTripDoc(payload),
    id,
    tenantId,
    createdAtISO: payload?.createdAtISO || existing?.createdAtISO || nowIso,
    updatedAtISO: nowIso,
  };

  await collection.updateOne({ tenantId, id }, { $set: doc }, { upsert: true });
  return doc;
}

async function deleteTripById(tenantId, id) {
  const collection = await getTripsCollection();
  const result = await collection.deleteOne({ tenantId, id });
  return result.deletedCount > 0;
}

module.exports = {
  listTrips,
  upsertTrip,
  deleteTripById,
};
