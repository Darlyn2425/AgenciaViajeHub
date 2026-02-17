const { getDb } = require("./mongo");

let ensuredIndexes = false;
const SETTINGS_COLLECTION = process.env.MONGODB_COLLECTION_SETTINGS || "settings";

async function getSettingsCollection() {
  const db = await getDb();
  const collection = db.collection(SETTINGS_COLLECTION);
  if (!ensuredIndexes) {
    try {
      await collection.createIndex({ tenantId: 1 }, { unique: true, sparse: false });
    } catch (error) {
      if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[settings-store] Index creation warning:", error?.message || error);
      }
    }
    ensuredIndexes = true;
  }
  return collection;
}

async function getSettingsByTenant(tenantId) {
  const collection = await getSettingsCollection();
  const row = await collection.findOne({ tenantId });
  if (!row) return null;
  return {
    tenantId: row.tenantId,
    settings: row.settings || {},
    updatedAt: row.updatedAt || "",
  };
}

async function upsertSettingsByTenant(tenantId, settings) {
  const collection = await getSettingsCollection();
  const now = new Date().toISOString();
  const doc = {
    tenantId,
    settings: settings || {},
    updatedAt: now,
  };
  await collection.updateOne({ tenantId }, { $set: doc }, { upsert: true });
  return doc;
}

module.exports = {
  getSettingsByTenant,
  upsertSettingsByTenant,
};
