import { state } from "../core/state.js";

export function getTenantId() {
  return String(state.settings?.tenantId || "default").trim() || "default";
}

export function withTenantQuery(path) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("tenantId", getTenantId());
  return `${url.pathname}${url.search}`;
}

export function tenantHeaders(extra = {}) {
  const token = String(state.auth?.apiToken || "").trim();
  return {
    "x-tenant-id": getTenantId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
