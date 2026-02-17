const { getDb } = require("./mongo");

let ensuredIndexes = false;
const CLIENTS_COLLECTION = process.env.MONGODB_COLLECTION_CLIENTS || "Clientes";

function normalizeClientDoc(input) {
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
      { email: pattern },
      { phone: pattern },
      { tripName: pattern },
    ],
  };
}

async function getClientsCollection() {
  const db = await getDb();
  const collection = db.collection(CLIENTS_COLLECTION);

  if (!ensuredIndexes) {
    try {
      await collection.createIndex({ tenantId: 1, id: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ tenantId: 1, updatedAtISO: -1 });
    } catch (error) {
      if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[clients-store] Index creation warning:", error?.message || error);
      }
    }
    ensuredIndexes = true;
  }

  return collection;
}

async function listClients({ tenantId, page = 1, limit = 100, search = "" } = {}) {
  const collection = await getClientsCollection();
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const safePage = Math.max(1, Number(page) || 1);
  const filter = { tenantId, ...buildSearchFilter(search) };
  const skip = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    collection.find(filter).sort({ updatedAtISO: -1, createdAtISO: -1 }).skip(skip).limit(safeLimit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    items: rows.map(normalizeClientDoc),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

async function upsertClient(tenantId, payload) {
  const nowIso = new Date().toISOString();
  const id = String(payload?.id || "").trim();
  if (!id) throw new Error("Client id is required");

  const collection = await getClientsCollection();
  const existing = await collection.findOne({ tenantId, id });
  const doc = {
    ...normalizeClientDoc(payload),
    id,
    tenantId,
    createdAtISO: payload?.createdAtISO || existing?.createdAtISO || nowIso,
    updatedAtISO: nowIso,
  };

  await collection.updateOne({ tenantId, id }, { $set: doc }, { upsert: true });
  return doc;
}

async function deleteClientById(tenantId, id) {
  const collection = await getClientsCollection();
  const result = await collection.deleteOne({ tenantId, id });
  return result.deletedCount > 0;
}

module.exports = {
  listClients,
  upsertClient,
  deleteClientById,
};
