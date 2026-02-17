import { saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal, toast } from "../utils/ui.js";
import { escapeHtml, matchesSearch, uid } from "../utils/helpers.js";
import { hasPermission } from "../core/auth.js";
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
let clientsApiSyncStarted = false;
let clientsApiSyncCompleted = false;
let clientsIsLoading = false;
let clientsLastFetchKey = "";

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchClientsFromApi({ search = "" } = {}) {
    const params = new URLSearchParams({ page: "1", limit: "500", search: String(search || "") });
    const response = await fetchWithTimeout(withTenantQuery(`/api/clients?${params.toString()}`), {
        headers: tenantHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return { items: data.items };
}

async function upsertClientToApi(client) {
    const response = await fetchWithTimeout(withTenantQuery("/api/clients"), {
        method: "POST",
        headers: tenantHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(client || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.item) throw new Error(data?.error || `HTTP ${response.status}`);
    return data.item;
}

async function deleteClientFromApi(id) {
    const response = await fetchWithTimeout(withTenantQuery(`/api/clients?id=${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers: tenantHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return true;
}

async function syncClientsFromApi(searchTerm = "") {
    const key = String(searchTerm || "").toLowerCase().trim();
    if (clientsIsLoading || (clientsApiSyncStarted && clientsLastFetchKey === key)) return;
    clientsApiSyncStarted = true;
    clientsIsLoading = true;
    clientsLastFetchKey = key;
    try {
        const remote = await fetchClientsFromApi({ search: key });
        replaceTenantItems("clients", remote.items);
        saveState();
        clientsApiSyncCompleted = true;
        if (window.render) window.render();
    } catch (error) {
        console.warn("[clients] sync warning:", error?.message || error);
    } finally {
        clientsApiSyncStarted = false;
        clientsIsLoading = false;
    }
}

function syncClientInBackground(payload) {
    upsertClientToApi(payload)
        .then((remoteItem) => {
            upsertTenantItem("clients", remoteItem);
            saveState();
            if (window.render) window.render();
        })
        .catch((error) => {
            toast(`Cliente guardado localmente. Error al sincronizar: ${error?.message || error}`);
        });
}

export function renderClients(searchTerm = "") {
    if (!clientsApiSyncCompleted || !clientsApiSyncStarted) {
        syncClientsFromApi(searchTerm);
    }

    const canManage = hasPermission("clients.manage") || hasPermission("*");
    const clients = getTenantItems("clients");
    const rows = clients
        .filter(c => matchesSearch(c, searchTerm))
        .map(c => `
    <tr>
      <td><strong>${escapeHtml(c.name)}</strong><div class="kbd">${escapeHtml(c.tripName || "")}</div></td>
      <td>${escapeHtml(c.phone || "")}</td>
      <td>${escapeHtml(c.email || "")}</td>
      <td>
        ${canManage ? `<button class="btn" onclick="window.editClient('${c.id}')">Editar</button>
        <button class="btn danger" onclick="window.deleteClient('${c.id}')">Eliminar</button>` : `<span class="kbd">Solo lectura</span>`}
      </td>
    </tr>
  `).join("");

    setContent(`
    <div class="card">
      ${renderModuleToolbar("clients",
        `<div><h2 style="margin:0;">Clientes</h2><div class="kbd">Base para asociar pagos/itinerarios.</div></div>`,
        `${canManage ? `<button class="btn primary" onclick="window.openClientModal()">+ Nuevo cliente</button>` : ``}`
    )}
      <hr/>
      <table class="table">
        <thead><tr><th>Cliente</th><th>Tel</th><th>Email</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">${clientsIsLoading ? "Cargando clientes..." : "No hay clientes todavía."}</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

export function openClientModal(existing = null) {
    if (!(hasPermission("clients.manage") || hasPermission("*"))) {
        toast("No tienes permiso para modificar clientes.");
        return;
    }
    const tripOptions = getTenantItems("trips").map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
    openModal({
        title: existing ? "Editar cliente" : "Nuevo cliente",
        bodyHtml: `
      <div class="form-layout form-layout--client">
        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">1</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Datos del Cliente</h4>
              <p class="form-section__hint">Completa solo lo esencial. Puedes editar luego.</p>
            </div>
          </div>
          <div class="grid">
            <div class="field col-6"><label>Nombre <span class="req">*</span></label><input id="cName" autofocus value="${escapeHtml(existing?.name || "")}" /></div>
            <div class="field col-6"><label>Teléfono</label><input id="cPhone" value="${escapeHtml(existing?.phone || "")}" /></div>
            <div class="field col-12"><label>Email</label><input id="cEmail" value="${escapeHtml(existing?.email || "")}" /></div>
            <div class="field col-12">
              <label>Viaje</label>
              <select id="cTrip">
                <option value="">(Sin asignar)</option>
                ${tripOptions}
              </select>
            </div>
          </div>
        </div>
      </div>
    `,
        onSave: () => {
            const name = document.getElementById("cName").value.trim();
            if (!name) { toast("Completa el nombre del cliente."); return; }
            const phone = document.getElementById("cPhone").value.trim();
            const email = document.getElementById("cEmail").value.trim();
            const tripId = document.getElementById("cTrip").value || "";
            const trip = findTenantItem("trips", t => t.id === tripId);

            const payload = {
                id: existing?.id || uid("cli"),
                name,
                phone,
                email,
                tripId,
                tripName: trip?.name || "",
            };

            if (existing) Object.assign(existing, payload);
            else pushTenantItem("clients", payload);

            saveState();
            closeModal();
            if (window.render) window.render();
            syncClientInBackground(payload);
        }
    });
    if (existing?.tripId) document.getElementById("cTrip").value = existing.tripId;
}

export function editClient(id) {
    const c = findTenantItem("clients", x => x.id === id);
    if (c) openClientModal(c);
}

export function deleteClient(id) {
    if (!(hasPermission("clients.manage") || hasPermission("*"))) {
        toast("No tienes permiso para eliminar clientes.");
        return;
    }
    if (!confirm("¿Eliminar cliente?")) return;
    const backup = findTenantItem("clients", x => x.id === id);
    removeTenantItems("clients", x => x.id === id);
    saveState();
    if (window.render) window.render();

    deleteClientFromApi(id).catch((error) => {
        if (backup) upsertTenantItem("clients", backup);
        saveState();
        if (window.render) window.render();
        toast(`No se pudo eliminar en servidor: ${error?.message || error}`);
    });
}

window.openClientModal = openClientModal;
window.editClient = editClient;
window.deleteClient = deleteClient;
