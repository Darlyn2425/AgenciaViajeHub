import { state } from "../core/state.js";
import { getTenantId } from "./tenant.js";

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function scopeRecords(records = [], tenantId = getTenantId()) {
  if (!Array.isArray(records)) return [];
  const out = [];
  for (const row of records) {
    if (!isRecord(row)) continue;
    if (!row.tenantId) row.tenantId = tenantId;
    if (row.tenantId === tenantId) out.push(row);
  }
  return out;
}

export function currentTenantId() {
  return getTenantId();
}

export function getTenantItems(key) {
  if (!Array.isArray(state[key])) state[key] = [];
  return scopeRecords(state[key]);
}

export function findTenantItem(key, predicate) {
  return getTenantItems(key).find(predicate);
}

export function pushTenantItem(key, item) {
  if (!Array.isArray(state[key])) state[key] = [];
  const tenantId = getTenantId();
  const next = { ...item, tenantId };
  state[key].push(next);
  return next;
}

export function replaceTenantItems(key, items = []) {
  if (!Array.isArray(state[key])) state[key] = [];
  const tenantId = getTenantId();
  const others = state[key].filter((row) => {
    if (!isRecord(row)) return false;
    if (!row.tenantId) row.tenantId = tenantId;
    return row.tenantId !== tenantId;
  });
  const scoped = scopeRecords(items, tenantId);
  state[key] = [...others, ...scoped];
}

export function upsertTenantItem(key, item, idField = "id") {
  if (!Array.isArray(state[key])) state[key] = [];
  const tenantId = getTenantId();
  const next = { ...(item || {}), tenantId };
  const id = String(next?.[idField] || "").trim();
  const idx = state[key].findIndex((row) => {
    if (!isRecord(row)) return false;
    if (!row.tenantId) row.tenantId = tenantId;
    const rowId = String(row?.[idField] || "").trim();
    return row.tenantId === tenantId && rowId && rowId === id;
  });
  if (idx >= 0) state[key][idx] = { ...state[key][idx], ...next };
  else state[key].push(next);
  return next;
}

export function removeTenantItems(key, predicate) {
  if (!Array.isArray(state[key])) state[key] = [];
  const tenantId = getTenantId();
  state[key] = state[key].filter((row) => {
    if (!isRecord(row)) return false;
    if (!row.tenantId) row.tenantId = tenantId;
    if (row.tenantId !== tenantId) return true;
    return !predicate(row);
  });
}
