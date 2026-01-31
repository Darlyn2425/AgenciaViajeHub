import { state } from "../core/state.js";
import { setContent } from "../utils/ui.js";

// We will dynamically import or pass these functions to avoid circular deps if possible,
// or just rely on ESM hoisting. For now, let's assume they are available globally or imported.
// Since we want to restructure, let's try to keeping dependencies explicit.
// But openPaymentPlanModal is in paymentPlans.js.
// Helper to just trigger global or imported actions.

export function renderDashboard() {
    setContent(`
    <div class="grid">
      <div class="card col-12">
        <h2>Dashboard</h2>
        <p>Hub operativo para Brianessa Travel: clientes, viajes, planes de pago e itinerarios.</p>
      </div>

      <div class="card col-4"><div class="row"><strong>Clientes</strong><span class="badge">${state.clients.length}</span></div></div>
      <div class="card col-4"><div class="row"><strong>Viajes</strong><span class="badge">${state.trips.length}</span></div></div>
      <div class="card col-4"><div class="row"><strong>Planes</strong><span class="badge">${state.paymentPlans.length}</span></div></div>

      <div class="card col-12">
        <div class="row">
          <div>
            <strong>Acciones rápidas</strong>
            <div class="kbd">Crea y guarda; luego exportas/importas por módulo o todo.</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn primary" onclick="window.openPaymentPlanModal()">+ Plan de pago</button>
            <button class="btn primary" onclick="window.openItineraryModal()">+ Itinerario</button>
          </div>
        </div>
      </div>
    </div>
  `);
}
