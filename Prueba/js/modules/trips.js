import { state, saveState, refreshTripNames } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal } from "../utils/ui.js";
import { escapeHtml, matchesSearch, uid } from "../utils/helpers.js";



export function renderTrips(searchTerm = "") {
  const rows = state.trips.filter(t => matchesSearch(t, searchTerm)).map(t => `
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
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay viajes todavía.</td></tr>`}</tbody>
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
      if (!name) return;
      const destination = document.getElementById("tDest").value.trim();
      const startDate = document.getElementById("tStart").value;
      const endDate = document.getElementById("tEnd").value;
      const status = document.getElementById("tStatus").value;

      if (existing) {
        Object.assign(existing, { name, destination, startDate, endDate, status });
      } else {
        state.trips.push({ id: uid("trip"), name, destination, startDate, endDate, status });
      }
      refreshTripNames();
      saveState();
      closeModal();
      if (window.render) window.render();
    }
  });
  if (existing?.status) document.getElementById("tStatus").value = existing.status;
}

export function editTrip(id) {
  const t = state.trips.find(x => x.id === id);
  if (t) openTripModal(t);
}

export function deleteTrip(id) {
  if (!confirm("¿Eliminar trip?")) return;
  state.trips = state.trips.filter(x => x.id !== id);
  refreshTripNames();
  saveState();
  if (window.render) window.render();
}

window.openTripModal = openTripModal;
window.editTrip = editTrip;
window.deleteTrip = deleteTrip;
