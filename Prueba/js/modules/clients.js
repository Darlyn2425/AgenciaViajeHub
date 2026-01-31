import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal } from "../utils/ui.js";
import { escapeHtml, matchesSearch, uid } from "../utils/helpers.js";

// We'll need a way to trigger re-renders or access global render.
// Ideally main.js orchestrates this, but for now we might import a "render" delegate or expose these functions.
// We will export functions that can be called by main.js or other modules.

export function renderClients(searchTerm = "") {
    const rows = state.clients.filter(c => matchesSearch(c, searchTerm)).map(c => `
    <tr>
      <td><strong>${escapeHtml(c.name)}</strong><div class="kbd">${escapeHtml(c.tripName || "")}</div></td>
      <td>${escapeHtml(c.phone || "")}</td>
      <td>${escapeHtml(c.email || "")}</td>
      <td>
        <button class="btn" onclick="window.editClient('${c.id}')">Editar</button>
        <button class="btn danger" onclick="window.deleteClient('${c.id}')">Eliminar</button>
      </td>
    </tr>
  `).join("");

    setContent(`
    <div class="card">
      ${renderModuleToolbar("clients",
        `<div><h2 style="margin:0;">Clientes</h2><div class="kbd">Base para asociar pagos/itinerarios.</div></div>`,
        `<button class="btn primary" onclick="window.openClientModal()">+ Nuevo cliente</button>`
    )}
      <hr/>
      <table class="table">
        <thead><tr><th>Cliente</th><th>Tel</th><th>Email</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay clientes todavía.</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

export function openClientModal(existing = null) {
    const tripOptions = state.trips.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
    openModal({
        title: existing ? "Editar cliente" : "Nuevo cliente",
        bodyHtml: `
      <div class="field"><label>Nombre</label><input id="cName" value="${escapeHtml(existing?.name || "")}" /></div>
      <div class="field"><label>Teléfono</label><input id="cPhone" value="${escapeHtml(existing?.phone || "")}" /></div>
      <div class="field"><label>Email</label><input id="cEmail" value="${escapeHtml(existing?.email || "")}" /></div>
      <div class="field">
        <label>Viaje</label>
        <select id="cTrip">
          <option value="">(Sin asignar)</option>
          ${tripOptions}
        </select>
      </div>
    `,
        onSave: () => {
            const name = document.getElementById("cName").value.trim();
            if (!name) return;
            const phone = document.getElementById("cPhone").value.trim();
            const email = document.getElementById("cEmail").value.trim();
            const tripId = document.getElementById("cTrip").value || "";
            const trip = state.trips.find(t => t.id === tripId);

            if (existing) {
                existing.name = name; existing.phone = phone; existing.email = email;
                existing.tripId = tripId; existing.tripName = trip?.name || "";
            } else {
                state.clients.push({ id: uid("cli"), name, phone, email, tripId, tripName: trip?.name || "" });
            }
            saveState();
            closeModal();
            // We expect a global render() to be available or we need to call renderClients again.
            // For now, let's assume window.render() or similar will be set up in main.js
            if (window.render) window.render();
        }
    });
    if (existing?.tripId) document.getElementById("cTrip").value = existing.tripId;
}

export function editClient(id) {
    const c = state.clients.find(x => x.id === id);
    if (c) openClientModal(c);
}

export function deleteClient(id) {
    if (!confirm("¿Eliminar cliente?")) return;
    state.clients = state.clients.filter(x => x.id !== id);
    saveState();
    if (window.render) window.render();
}

// Attach to window for onclick handlers in HTML strings
window.openClientModal = openClientModal;
window.editClient = editClient;
window.deleteClient = deleteClient;
