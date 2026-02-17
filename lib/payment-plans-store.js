const { getDb } = require("./mongo");

let ensuredIndexes = false;
const PAYMENT_PLANS_COLLECTION = process.env.MONGODB_COLLECTION_PAYMENT_PLANS || "paymentPlans";

function normalizePaymentPlanDoc(input) {
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
      { clientName: pattern },
      { clientDisplay: pattern },
      { tripName: pattern },
      { tripDisplay: pattern },
      { statusLabel: pattern },
      { currency: pattern },
    ],
  };
}

async function getPaymentPlansCollection() {
  const db = await getDb();
  const collection = db.collection(PAYMENT_PLANS_COLLECTION);

  if (!ensuredIndexes) {
    try {
      await collection.createIndex({ id: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ updatedAtISO: -1 });
    } catch (error) {
      if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[payment-plans-store] Index creation warning:", error?.message || error);
      }
    }
    ensuredIndexes = true;
  }

  return collection;
}

async function listPaymentPlans({ tenantId, page = 1, limit = 20, search = "" } = {}) {
  const collection = await getPaymentPlansCollection();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const filter = { tenantId, ...buildSearchFilter(search) };
  const skip = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    collection.find(filter).sort({ updatedAtISO: -1, createdAtISO: -1 }).skip(skip).limit(safeLimit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    items: rows.map(normalizePaymentPlanDoc),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

async function upsertPaymentPlan(tenantId, payload) {
  const nowIso = new Date().toISOString();
  const id = String(payload?.id || "").trim();
  if (!id) throw new Error("Payment plan id is required");

  const collection = await getPaymentPlansCollection();
  const existing = await collection.findOne({ id, tenantId });
  const doc = {
    ...normalizePaymentPlanDoc(payload),
    id,
    tenantId,
    createdAtISO: payload?.createdAtISO || existing?.createdAtISO || nowIso,
    updatedAtISO: nowIso,
  };

  await collection.updateOne({ id, tenantId }, { $set: doc }, { upsert: true });
  return doc;
}

async function deletePaymentPlanById(tenantId, id) {
  const collection = await getPaymentPlansCollection();
  const result = await collection.deleteOne({ id, tenantId });
  return result.deletedCount > 0;
}

module.exports = {
  listPaymentPlans,
  upsertPaymentPlan,
  deletePaymentPlanById,
};
