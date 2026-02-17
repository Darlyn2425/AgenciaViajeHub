import { saveState, refreshTripNames } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal, toast } from "../utils/ui.js";
import { escapeHtml, matchesSearch, uid } from "../utils/helpers.js";
import { withTenantQuery, tenantHeaders } from "../utils/tenant.js";
import {
  getTenantItems,
  findTenantItem,
  upsertTenantItem,
  pushTenantItem,
  removeTenantItems,
  replaceTenantItems,
} from "../utils/tenant-data.js";

const API_TIMEOUT_MS = 8000;
let tripsApiSyncStarted = false;
let tripsApiSyncCompleted = false;
let tripsIsLoading = false;
let tripsLastFetchKey = "";

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTripsFromApi({ search = "" } = {}) {
  const params = new URLSearchParams({ page: "1", limit: "500", search: String(search || "") });
  const response = await fetchWithTimeout(withTenantQuery(`/api/trips?${params.toString()}`), {
    headers: tenantHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !Array.isArray(data?.items)) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return { items: data.items };
}

async function upsertTripToApi(trip) {
  const response = await fetchWithTimeout(withTenantQuery("/api/trips"), {
    method: "POST",
    headers: tenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(trip || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data?.item) throw new Error(data?.error || `HTTP ${response.status}`);
  return data.item;
}

async function deleteTripFromApi(id) {
  const response = await fetchWithTimeout(withTenantQuery(`/api/trips?id=${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: tenantHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return true;
}

async function syncTripsFromApi(searchTerm = "") {
  const key = String(searchTerm || "").toLowerCase().trim();
  if (tripsIsLoading || (tripsApiSyncStarted && tripsLastFetchKey === key)) return;
  tripsApiSyncStarted = true;
  tripsIsLoading = true;
  tripsLastFetchKey = key;
  try {
    const remote = await fetchTripsFromApi({ search: key });
    replaceTenantItems("trips", remote.items);
    refreshTripNames();
    saveState();
    tripsApiSyncCompleted = true;
    if (window.render) window.render();
  } catch (error) {
    console.warn("[trips] sync warning:", error?.message || error);
  } finally {
    tripsApiSyncStarted = false;
    tripsIsLoading = false;
  }
}

function syncTripInBackground(payload) {
  upsertTripToApi(payload)
    .then((remoteItem) => {
      upsertTenantItem("trips", remoteItem);
      refreshTripNames();
      saveState();
      if (window.render) window.render();
    })
    .catch((error) => {
      toast(`Viaje guardado localmente. Error al sincronizar: ${error?.message || error}`);
    });
}

export function renderTrips(searchTerm = "") {
  if (!tripsApiSyncCompleted || !tripsApiSyncStarted) {
    syncTripsFromApi(searchTerm);
  }

  const trips = getTenantItems("trips");
  const rows = trips.filter(t => matchesSearch(t, searchTerm)).map(t => `
    <tr>
      <td><strong>${escapeHtml(t.name)}</strong><div class="kbd">${escapeHtml(t.destination || "")}</div></td>
      <td>${escapeHtml(t.startDate || "")}</td>
      <td>${escapeHtml(t.status || "Activo")}</td>
      <td>
        <button class="btn" onclick="window.editTrip('${t.id}')">Editar</button>
        <button class="btn danger" onclick="window.deleteTrip('${t.id}')">Eliminar</button>
      </td>
    </tr>
  `).join("");

  setContent(`
    <div class="card">
      ${renderModuleToolbar("trips",
    `<div><h2 style="margin:0;">Viajes / Grupos</h2><div class="kbd">Crea el viaje y asocia todo.</div></div>`,
    `<button class="btn primary" onclick="window.openTripModal()">+ Nuevo viaje</button>`
  )}
      <hr/>
      <table class="table">
        <thead><tr><th>Viaje</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">${tripsIsLoading ? "Cargando viajes..." : "No hay viajes todavía."}</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

export function openTripModal(existing = null) {
  openModal({
    title: existing ? "Editar viaje" : "Nuevo viaje",
    bodyHtml: `
      <div class="field"><label>Nombre del viaje</label><input id="tName" value="${escapeHtml(existing?.name || "")}" placeholder="Ej: Dubai con Richard Santos" /></div>
      <div class="field"><label>Destino</label><input id="tDest" value="${escapeHtml(existing?.destination || "")}" placeholder="Ej: Dubai, UAE" /></div>
      <div class="grid">
        <div class="field col-6"><label>Fecha Inicio</label><input id="tStart" type="date" value="${escapeHtml(existing?.startDate || "")}" /></div>
        <div class="field col-6"><label>Fecha Fin</label><input id="tEnd" type="date" value="${escapeHtml(existing?.endDate || "")}" /></div>
      </div>
      <div class="field">
        <label>Estado</label>
        <select id="tStatus">
          <option value="Activo">Activo</option>
          <option value="Finalizado">Finalizado</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </div>
    `,
    onSave: () => {
      const name = document.getElementById("tName").value.trim();
      if (!name) {
        toast("El viaje necesita un nombre.");
        return;
      }
      const destination = document.getElementById("tDest").value.trim();
      const startDate = document.getElementById("tStart").value;
      const endDate = document.getElementById("tEnd").value;
      const status = document.getElementById("tStatus").value;

      const payload = {
        id: existing?.id || uid("trip"),
        name,
        destination,
        startDate,
        endDate,
        status,
      };

      if (existing) Object.assign(existing, payload);
      else pushTenantItem("trips", payload);

      refreshTripNames();
      saveState();
      closeModal();
      if (window.render) window.render();
      syncTripInBackground(payload);
    }
  });
  if (existing?.status) document.getElementById("tStatus").value = existing.status;
}

export function editTrip(id) {
  const t = findTenantItem("trips", x => x.id === id);
  if (t) openTripModal(t);
}

export function deleteTrip(id) {
  if (!confirm("¿Eliminar trip?")) return;
  const backup = findTenantItem("trips", x => x.id === id);
  removeTenantItems("trips", x => x.id === id);
  refreshTripNames();
  saveState();
  if (window.render) window.render();

  deleteTripFromApi(id).catch((error) => {
    if (backup) upsertTenantItem("trips", backup);
    refreshTripNames();
    saveState();
    if (window.render) window.render();
    toast(`No se pudo eliminar en servidor: ${error?.message || error}`);
  });
}

window.openTripModal = openTripModal;
window.editTrip = editTrip;
window.deleteTrip = deleteTrip;
