import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal, icon, toast } from "../utils/ui.js";
import { escapeHtml, matchesSearch, uid, parseNum, round2, toMoney, formatDateLongISO, buildScheduleDates, splitInstallments, ordinalPago } from "../utils/helpers.js";
import { withTenantQuery, tenantHeaders } from "../utils/tenant.js";
import { hasPermission } from "../core/auth.js";
import { getTenantItems, findTenantItem, pushTenantItem } from "../utils/tenant-data.js";

// Make functions available globally for inline onclick handlers
window.exportPaymentPlanPDF = exportPaymentPlanPDF;
window.previewPaymentPlanPDF = previewPaymentPlanPDF;
window.editPaymentPlan = editPaymentPlan;
window.duplicatePaymentPlan = duplicatePaymentPlan;
window.deletePaymentPlan = deletePaymentPlan;
window.viewPaymentPlan = viewPaymentPlan;
window.attachPaymentPlan = attachPaymentPlan;
window.openPaymentPlanModal = openPaymentPlanModal;
window.generateAndAttachPaymentPlanPDF = generateAndAttachPaymentPlanPDF;
window.previewPaymentPlanAttachment = previewPaymentPlanAttachment;
window.downloadPaymentPlanAttachment = downloadPaymentPlanAttachment;
window.removePaymentPlanAttachment = removePaymentPlanAttachment;
window.togglePlanMenu = togglePlanMenu;

const API_TIMEOUT_MS = 8000;
const PAYMENT_PLANS_PAGE_SIZE = 20;
let paymentPlansApiSyncStarted = false;
let paymentPlansApiSyncCompleted = false;
let paymentPlansIsLoading = false;
let paymentPlansPage = 1;
let paymentPlansLastSearchTerm = "";
let paymentPlansTotal = 0;
let paymentPlansLastFetchKey = "";

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchPaymentPlansFromApi({ page = 1, limit = PAYMENT_PLANS_PAGE_SIZE, search = "" } = {}) {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: String(search || ""),
    });
    const response = await fetchWithTimeout(withTenantQuery(`/api/payment-plans?${params.toString()}`), {
        headers: tenantHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error || `HTTP ${response.status}`);
    }
    const pagination = data?.pagination || {};
    return {
        items: data.items,
        total: Number(pagination.total || data.items.length || 0),
    };
}

async function upsertPaymentPlanToApi(plan) {
    const response = await fetchWithTimeout(withTenantQuery("/api/payment-plans"), {
        method: "POST",
        headers: tenantHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(plan || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.item) {
        throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data.item;
}

async function upsertClientToApi(client) {
    const response = await fetchWithTimeout(withTenantQuery("/api/clients"), {
        method: "POST",
        headers: tenantHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(client || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.item) {
        throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data.item;
}

function syncClientInBackground(clientObj) {
    if (!clientObj?.id) return;
    upsertClientToApi({
        id: clientObj.id,
        name: clientObj.name || "",
        phone: clientObj.phone || "",
        email: clientObj.email || "",
        tripId: clientObj.tripId || "",
        tripName: clientObj.tripName || "",
    }).catch((error) => {
        console.warn("[paymentPlans] auto-client sync warning:", error?.message || error);
    });
}

async function deletePaymentPlanFromApi(id) {
    const response = await fetchWithTimeout(withTenantQuery(`/api/payment-plans?id=${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers: tenantHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || data?.deleted !== true) {
        throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
}

function getActiveRoute() {
    return document.querySelector(".nav-item.active")?.dataset?.route || "";
}

function getCurrentSearchTermFromInput() {
    const input = document.getElementById("globalSearch") || document.getElementById("searchInput");
    return (input?.value || "").toLowerCase();
}

function rerenderPaymentPlansView() {
    if (getActiveRoute() === "payment-plans") {
        renderPaymentPlans(getCurrentSearchTermFromInput());
        return;
    }
    if (window.render) window.render();
}

function goToPaymentPlansPage(page) {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    paymentPlansPage = safePage;
    paymentPlansApiSyncStarted = false;
    rerenderPaymentPlansView();
}

window.goToPaymentPlansPage = goToPaymentPlansPage;

function syncPaymentPlanInBackground(plan) {
    Promise.resolve().then(async () => {
        try {
            const remoteItem = await upsertPaymentPlanToApi(plan);
            const idx = state.paymentPlans.findIndex(x => x.id === remoteItem.id);
            if (idx >= 0) {
                state.paymentPlans[idx] = remoteItem;
                saveState();
                rerenderPaymentPlansView();
            }
            paymentPlansApiSyncStarted = false;
            paymentPlansLastFetchKey = "";
            ensurePaymentPlansApiSyncOnce();
        } catch {
            toast("Guardado local OK. No se pudo sincronizar con la base de datos.");
        }
    });
}

async function ensurePaymentPlansApiSyncOnce() {
    const fetchKey = `${paymentPlansPage}|${paymentPlansLastSearchTerm}`;
    if (paymentPlansIsLoading || (paymentPlansApiSyncStarted && paymentPlansLastFetchKey === fetchKey)) return;
    paymentPlansApiSyncStarted = true;
    paymentPlansIsLoading = true;
    paymentPlansLastFetchKey = fetchKey;
    try {
        const remote = await fetchPaymentPlansFromApi({
            page: paymentPlansPage,
            limit: PAYMENT_PLANS_PAGE_SIZE,
            search: paymentPlansLastSearchTerm,
        });
        if (remote.total > 0) {
            state.paymentPlans = remote.items;
            paymentPlansTotal = remote.total;
        } else if (Array.isArray(state.paymentPlans) && state.paymentPlans.length > 0) {
            for (const p of state.paymentPlans) {
                try {
                    await upsertPaymentPlanToApi(p);
                } catch {
                    // ignore per-item sync errors
                }
            }
            const reloaded = await fetchPaymentPlansFromApi({
                page: paymentPlansPage,
                limit: PAYMENT_PLANS_PAGE_SIZE,
                search: paymentPlansLastSearchTerm,
            });
            state.paymentPlans = reloaded.items;
            paymentPlansTotal = reloaded.total;
        } else {
            state.paymentPlans = [];
            paymentPlansTotal = 0;
        }
        saveState();
        paymentPlansApiSyncCompleted = true;
        rerenderPaymentPlansView();
    } catch {
        paymentPlansApiSyncStarted = false;
    } finally {
        paymentPlansIsLoading = false;
    }
}

function getConfiguredPaymentPlanStatuses() {
    const list = state.settings?.modules?.paymentPlans?.statuses || [];
    if (list.length) return list;
    return [{ id: "pay_draft", label: "Borrador", color: "#64748b", isDefault: true, isFinal: false, order: 1 }];
}

function getDefaultPaymentPlanStatus() {
    const statuses = getConfiguredPaymentPlanStatuses();
    return statuses.find(s => s.isDefault) || statuses[0];
}

export function renderPaymentPlans(searchTerm = "") {
    if (searchTerm !== paymentPlansLastSearchTerm) {
        paymentPlansPage = 1;
        paymentPlansLastSearchTerm = searchTerm;
        paymentPlansApiSyncStarted = false;
    }
    if (!paymentPlansApiSyncCompleted || !paymentPlansApiSyncStarted) {
        ensurePaymentPlansApiSyncOnce();
    }
    const canManage = hasPermission("paymentPlans.manage") || hasPermission("*");
    const statuses = getConfiguredPaymentPlanStatuses();
    const getStatus = (p) => statuses.find(s => s.id === p.statusId) || getDefaultPaymentPlanStatus();
    const localFilteredFallback = state.paymentPlans.filter(p => matchesSearch(p, searchTerm));
    const plansForTable = paymentPlansApiSyncCompleted ? state.paymentPlans : localFilteredFallback;
    const totalRows = paymentPlansApiSyncCompleted ? (paymentPlansTotal || plansForTable.length) : plansForTable.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / PAYMENT_PLANS_PAGE_SIZE));
    if (paymentPlansPage > totalPages) paymentPlansPage = totalPages;
    const pageStart = (paymentPlansPage - 1) * PAYMENT_PLANS_PAGE_SIZE;
    const rows = plansForTable.map(p => {
        const status = getStatus(p);
        const hasPdf = !!p.attachmentPdf;
        const pdfBadge = hasPdf ? `<span class="badge pdf" title="Tiene PDF adjunto">PDF</span>` : ``;

        const menuItems = `
      <button class="menu-item" onclick="window.previewPaymentPlanPDF('${p.id}')">
        <span class="mi-ic">${icon('eye')}</span>
        <span class="mi-tx">Ver PDF</span>
      </button>
      <div class="menu-sep"></div>
      <button class="menu-item" onclick="window.exportPaymentPlanPDF('${p.id}')">
        <span class="mi-ic">${icon('download')}</span>
        <span class="mi-tx">Descargar plan (PDF)</span>
      </button>
      ${canManage ? `<button class="menu-item" onclick="window.duplicatePaymentPlan('${p.id}')">
        <span class="mi-ic">${icon('copy')}</span>
        <span class="mi-tx">Duplicar</span>
      </button>
      <div class="menu-sep"></div>` : ``}
      ${hasPdf ? `
        <div class="menu-sep"></div>
        <button class="menu-item" onclick="window.previewPaymentPlanAttachment('${p.id}')">
          <span class="mi-ic">${icon('eye')}</span>
          <span class="mi-tx">Ver PDF adjunto</span>
        </button>
        <button class="menu-item" onclick="window.downloadPaymentPlanAttachment('${p.id}')">
          <span class="mi-ic">${icon('download')}</span>
          <span class="mi-tx">Descargar PDF adjunto</span>
        </button>
        <button class="menu-item danger" onclick="window.removePaymentPlanAttachment('${p.id}')">
          <span class="mi-ic">${icon('x')}</span>
          <span class="mi-tx">Quitar PDF adjunto</span>
        </button>
      ` : ``}
      ${canManage ? `<div class="menu-sep"></div>
      <button class="menu-item danger" onclick="window.deletePaymentPlan('${p.id}')">
        <span class="mi-ic">${icon('trash')}</span>
        <span class="mi-tx">Eliminar plan</span>
      </button>` : ``}
    `;

        return `
      <tr>
        <td>
          <div class="plan-cell">
            <div class="plan-main">
              <strong>${escapeHtml(p.clientName || p.clientDisplay || "Plan")}</strong>
              ${pdfBadge}
            </div>
            <div class="kbd">${escapeHtml(p.tripName || p.tripDisplay || "")}</div>
            <div style="margin-top:6px;">
              <span class="status-chip" style="--status-color:${escapeHtml(status.color || "#64748b")}">${escapeHtml(status.label || "Estado")}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(p.currency || state.settings.currencyDefault)}</td>
        <td>${escapeHtml(p.startDate || "")}</td>
        <td>
          <div class="actions compact">
            ${canManage ? `<button class="icon-btn" onclick="window.viewPaymentPlan('${p.id}')">${icon('eye')}</button>
            <button class="icon-btn" onclick="window.editPaymentPlan('${p.id}')">${icon('edit')}</button>` : ``}

            <div class="action-menu" data-menu="${p.id}">
              <button class="icon-btn menu-trigger" onclick="window.togglePlanMenu(event,'${p.id}')">${icon('dots')}</button>
              <div class="menu-pop" id="plan-menu-${p.id}" hidden>
                ${menuItems}
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
    }).join("");

    setContent(`
    <div class="card">
      ${renderModuleToolbar("paymentPlans",
        `<div><h2 style="margin:0;">Planes de pago</h2><div class="kbd">Tú das lo principal y se calcula todo (cuotas/fechas/recargo).</div></div>`,
        `${canManage ? `<button class="btn primary" onclick="window.openPaymentPlanModal()">+ Nuevo plan</button>` : ``}`
    )}
      <hr/>
      <table class="table">
        <thead><tr><th>Plan</th><th>Moneda</th><th>Inicio</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">${paymentPlansIsLoading ? "Cargando planes..." : "No hay planes todavía."}</td></tr>`}</tbody>
      </table>
      <div class="row" style="margin-top:10px;">
        <div class="kbd">Mostrando ${totalRows ? pageStart + 1 : 0}-${Math.min(pageStart + PAYMENT_PLANS_PAGE_SIZE, totalRows)} de ${totalRows}</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn" ${paymentPlansPage <= 1 ? "disabled" : ""} onclick="window.goToPaymentPlansPage(${paymentPlansPage - 1})">Anterior</button>
          <div class="kbd">Página ${paymentPlansPage} / ${totalPages}</div>
          <button class="btn" ${paymentPlansPage >= totalPages ? "disabled" : ""} onclick="window.goToPaymentPlansPage(${paymentPlansPage + 1})">Siguiente</button>
        </div>
      </div>
    </div>
  `);
}

export function openPaymentPlanModal(existing = null) {
    if (!(hasPermission("paymentPlans.manage") || hasPermission("*"))) {
        toast("No tienes permiso para modificar planes de pago.");
        return;
    }
    const isEditing = !!existing && !existing.__draftDuplicate;
    const paymentStatuses = getConfiguredPaymentPlanStatuses();
    const defaultStatus = getDefaultPaymentPlanStatus();
    const currentStatusId = existing?.statusId || defaultStatus.id;
    const clientOptions = getTenantItems("clients").map(c => `<option value="${escapeHtml(c.name)}"></option>`).join("");
    const tripOptions = getTenantItems("trips").map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");

    openModal({
        title: isEditing ? "Editar plan de pago" : "Nuevo plan de pago",
        bodyHtml: `
      <div class="form-layout form-layout--payment">
        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">1</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Cliente y Viaje</h4>
              <p class="form-section__hint">Selecciona cliente y viaje para contextualizar el plan.</p>
            </div>
          </div>
          <div class="grid">
            <div class="field col-12">
              <label>Cliente (buscar o crear) <span class="req">*</span></label>
              <input
                id="pClientSearch"
                list="pClientList"
                autofocus
                value="${escapeHtml(existing?.clientName || existing?.clientDisplay || "")}"
                placeholder="Escribe para buscar. Si no existe, se creará al guardar."
              />
              <datalist id="pClientList">${clientOptions}</datalist>
              <div class="kbd" style="margin-top:6px;">Si el nombre no existe en clientes, se agrega automáticamente.</div>
            </div>
          </div>

          <div class="grid">
            <div class="field col-6">
              <label>Viaje (opcional si no está creado)</label>
              <select id="pTrip"><option value="">(Sin seleccionar)</option>${tripOptions}</select>
            </div>
            <div class="field col-6">
              <label>Nombre del viaje (si no usas el select)</label>
              <input id="pTripDisplay" value="${escapeHtml(existing?.tripDisplay || "")}" placeholder="Ej: Dubai con Richard Santos (Escala Dubai)" />
            </div>
          </div>

          <div class="field">
            <label>Mensaje adicional (opcional)</label>
            <input id="pExtra" value="${escapeHtml(existing?.extra || "")}" placeholder="Ej: con Richard Santos (ESCALA DUBAI)" />
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">2</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Configuración del Plan</h4>
              <p class="form-section__hint">Define monto, fechas, frecuencia y método de pago.</p>
            </div>
          </div>
          <div class="grid">
            <div class="field col-4">
              <label>Estado</label>
              <select id="pStatus">
                ${paymentStatuses.map(st => `<option value="${escapeHtml(st.id)}" ${st.id === currentStatusId ? "selected" : ""}>${escapeHtml(st.label)}</option>`).join("")}
              </select>
            </div>
            <div class="field col-4">
              <label>Moneda <span class="req">*</span></label>
              <select id="pCurrency">
                <option value="USD">USD</option>
                <option value="DOP">DOP</option>
              </select>
            </div>
            <div class="field col-4"><label>Monto total <span class="req">*</span></label><input id="pTotal" value="${escapeHtml(existing?.total || "")}" placeholder="Ej: 3797" /></div>
          </div>

          <div class="grid">
            <div class="field col-4"><label>Descuento</label><input id="pDiscount" value="${escapeHtml(existing?.discount || "0")}" placeholder="Ej: 300" /></div>
            <div class="field col-4"><label>Reserva pagada</label><input id="pDeposit" value="${escapeHtml(existing?.deposit || "0")}" placeholder="Ej: 250" /></div>
            <div class="field col-4">
              <label>Frecuencia</label>
              <select id="pFreq"><option>Mensual</option><option>Quincenal</option></select>
            </div>
          </div>

          <div class="grid">
            <div class="field col-4">
              <label>Forma de pago</label>
              <select id="pMethod"><option>Transferencia</option><option>Tarjeta</option></select>
            </div>
            <div class="field col-4"><label>Fecha inicio <span class="req">*</span></label><input id="pStart" type="date" value="${escapeHtml(existing?.startDate || "")}" /></div>
            <div class="field col-4"><label>Fecha fin <span class="req">*</span></label><input id="pEnd" type="date" value="${escapeHtml(existing?.endDate || "")}" /></div>
          </div>

          <div class="field">
            <label>Link de pago</label>
            <input id="pLink" value="${escapeHtml(existing?.paymentLink || "")}" placeholder="Pega tu link aquí" />
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">3</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Texto para PDF</h4>
              <p class="form-section__hint">Genera el texto base y ajústalo antes de guardar.</p>
            </div>
          </div>
          <div class="row">
            <button class="btn" id="pGenerate">Generar texto (formato PDF)</button>
            <span class="kbd">Usa el estilo de tu PDF de Dubái.</span>
          </div>

          <div class="field">
            <label>Texto generado</label>
            <textarea id="pText" placeholder="Aquí sale el documento...">${escapeHtml(existing?.text || "")}</textarea>
          </div>
        </div>
      </div>
    `,
        onSave: () => {
            const normalizeClientName = (v) => (v || "").trim().replace(/\s+/g, " ").toLowerCase();
            const clientInputRaw = document.getElementById("pClientSearch").value.trim();
            const normalizedClientInput = normalizeClientName(clientInputRaw);
            let clientObj = normalizedClientInput
                ? findTenantItem("clients", c => normalizeClientName(c.name) === normalizedClientInput)
                : null;

            if (!clientObj && clientInputRaw) {
                clientObj = {
                    id: uid("cli"),
                    name: clientInputRaw,
                    phone: "",
                    email: "",
                    tripId: "",
                    tripName: ""
                };
                clientObj = pushTenantItem("clients", clientObj);
                syncClientInBackground(clientObj);
                toast("Cliente creado automáticamente en el módulo Clientes.");
            }

            const clientId = clientObj?.id || "";
            const tripId = document.getElementById("pTrip").value || "";
            const tripObj = findTenantItem("trips", t => t.id === tripId);
            const selectedStatusId = document.getElementById("pStatus").value;
            const selectedStatus = paymentStatuses.find(st => st.id === selectedStatusId) || defaultStatus;

            const clientDisplay = clientInputRaw;
            const tripDisplay = document.getElementById("pTripDisplay").value.trim();
            const extra = document.getElementById("pExtra").value.trim();
            const currency = document.getElementById("pCurrency").value;
            const total = parseNum(document.getElementById("pTotal").value);
            const discount = parseNum(document.getElementById("pDiscount").value);
            const deposit = parseNum(document.getElementById("pDeposit").value);
            const freq = document.getElementById("pFreq").value;
            const method = document.getElementById("pMethod").value;
            const startDate = document.getElementById("pStart").value || "";
            const endDate = document.getElementById("pEnd").value || "";
            const paymentLink = document.getElementById("pLink").value.trim();
            const text = document.getElementById("pText").value.trim();
            if (!clientInputRaw) { toast("Completa el cliente."); return; }
            if (!currency) { toast("Selecciona la moneda."); return; }
            if (!(total > 0)) { toast("Ingresa un monto total válido."); return; }
            if (!startDate || !endDate) { toast("Completa fecha inicio y fin."); return; }

            const payload = {
                id: isEditing ? existing.id : uid("pay"),
                statusId: selectedStatus.id,
                statusLabel: selectedStatus.label,
                clientId,
                tripId,
                clientName: clientObj?.name || "",
                tripName: tripObj?.name || "",
                clientDisplay,
                tripDisplay,
                extra,
                currency,
                total,
                discount,
                deposit,
                freq,
                method,
                startDate,
                endDate,
                paymentLink,
                text,
                updatedAt: new Date().toLocaleString(state.settings.locale),
            };

            if (isEditing) Object.assign(existing, payload);
            else state.paymentPlans.push(payload);

            saveState();
            closeModal();
            rerenderPaymentPlansView();
            toast("Plan guardado.");
            syncPaymentPlanInBackground(payload);
        }
    });

    if (existing) {
        if (existing.tripId) document.getElementById("pTrip").value = existing.tripId;
        if (existing.currency) document.getElementById("pCurrency").value = existing.currency;
        if (existing.freq) document.getElementById("pFreq").value = existing.freq;
        if (existing.method) document.getElementById("pMethod").value = existing.method;
    }

    document.getElementById("pGenerate").onclick = () => {
        const s = state.settings;
        const normalizeClientName = (v) => (v || "").trim().replace(/\s+/g, " ").toLowerCase();
        const clientSearchValue = document.getElementById("pClientSearch").value.trim();
        const clientObj = clientSearchValue
            ? findTenantItem("clients", c => normalizeClientName(c.name) === normalizeClientName(clientSearchValue))
            : null;
        const tripSel = document.getElementById("pTrip").value || "";
        const tripObj = findTenantItem("trips", t => t.id === tripSel);

        const cliente = (clientObj?.name || clientSearchValue || "Cliente");
        const viaje = (tripObj?.name || document.getElementById("pTripDisplay").value.trim() || "Viaje");
        const extra = document.getElementById("pExtra").value.trim();
        const currency = document.getElementById("pCurrency").value;

        const total = parseNum(document.getElementById("pTotal").value);
        const descuento = parseNum(document.getElementById("pDiscount").value);
        const reserva = parseNum(document.getElementById("pDeposit").value);
        const freq = document.getElementById("pFreq").value;
        const method = document.getElementById("pMethod").value;
        const startISO = document.getElementById("pStart").value || "";
        const endISO = document.getElementById("pEnd").value || "";
        const link = document.getElementById("pLink").value.trim();

        const totalDesc = round2(total - descuento);
        const restante = round2(totalDesc - reserva);

        const dates = buildScheduleDates({ startISO, endISO, frequency: freq });
        const cuotas = dates.length || 0;
        const montos = cuotas ? splitInstallments(restante, cuotas) : [];
        const montoCuotaBase = cuotas ? montos[0] : 0;

        const feePct = Number(s.cardFeePct || 3.5);
        const montoCuotaTarjeta = round2(montoCuotaBase * (1 + (feePct / 100)));

        const titulo = `Plan de Pagos Para el Viaje a ${viaje}${extra ? "\n(" + extra + ")" : ""}`;

        let out = "";
        out += `${s.companyName}\n`;
        out += `Teléfono: ${s.phone} | Correo electrónico: ${s.email}\n`;
        out += `Redes sociales: Instagram: ${s.instagram} | Facebook: ${s.facebook}\n`;
        out += `Sitio web: ${s.website}\n\n`;

        out += `${titulo}\n\n`;
        out += `Estimada, ${cliente}:\n`;
        out += `Nos complace proporcionarle las opciones de pago personalizadas para completar el monto pendiente de su viaje a ${viaje}${extra ? " " + extra : ""}. Este documento incluye detalles claros y flexibles para su planificación.\n\n`;

        out += `Datos del Cliente\n`;
        out += `• Nombre del Cliente: ${cliente}\n`;
        out += `• Monto Total del Viaje: ${toMoney(total, currency)}\n`;
        out += `• Descuento aplicado: ${toMoney(descuento, currency)}\n`;
        out += `• Monto con Descuento: ${toMoney(totalDesc, currency)}\n`;
        out += `• Monto de Reservación: ${toMoney(reserva, currency)} (ya pagado)\n`;
        out += `• Monto Total Original Restante: ${toMoney(restante, currency)}\n`;
        out += `• Monto Pendiente Final: ${toMoney(restante, currency)}\n`;
        out += `• Fecha de Inicio de Pago: ${formatDateLongISO(startISO)}\n`;
        out += `• Fecha Final de Pago: ${formatDateLongISO(endISO)}\n\n`;

        out += `Modalidades de Pago ${freq}\n`;
        out += `• Cantidad de Cuotas: ${cuotas}\n`;
        out += `• Monto por Cuota: ${toMoney(montoCuotaBase, currency)}\n`;

        out += `• Fechas de Pago:\n`;
        dates.forEach((d, i) => {
            out += `o ${ordinalPago(i)} pago: ${formatDateLongISO(d)}\n`;
        });

        out += `\n👉 Realiza tus pagos aquí\n${link || "(pendiente de link)"}\n\n`;

        if (method === "Tarjeta") {
            out += `Nota Importante\n`;
            out += `Costo Adicional: El monto por cuota es de ${toMoney(montoCuotaTarjeta, currency)} debido a un cargo adicional de ${feePct}% por el uso de tarjeta de crédito/débito. Este cargo cubre los costos de procesamiento y es una tarifa estándar para pagos con tarjeta.\n`;
            out += `Fechas específicas: Las fechas indicadas son las programadas para sus pagos según la modalidad seleccionada. Si necesita realizar algún ajuste, contáctenos a la brevedad.\n`;
            out += `Atención personalizada: Nuestro equipo está a su disposición para aclarar cualquier duda o atender cualquier necesidad adicional.\n`;
        }

        document.getElementById("pText").value = out;
    };
}

export function editPaymentPlan(id) {
    const p = state.paymentPlans.find(x => x.id === id);
    if (!p) { toast("No encontré ese plan."); return; }
    openPaymentPlanModal(p);
}

export function duplicatePaymentPlan(id) {
    if (!(hasPermission("paymentPlans.manage") || hasPermission("*"))) {
        toast("No tienes permiso para duplicar planes.");
        return;
    }
    const source = state.paymentPlans.find(x => x.id === id);
    if (!source) { toast("No encontré ese plan."); return; }

    document.querySelectorAll(".menu-pop").forEach(el => el.hidden = true);
    const draft = typeof structuredClone === "function"
        ? structuredClone(source)
        : JSON.parse(JSON.stringify(source));

    delete draft.id;
    delete draft.updatedAt;
    delete draft.attachmentPdf;
    draft.__draftDuplicate = true;

    setTimeout(() => openPaymentPlanModal(draft), 0);
    toast("Formulario duplicado listo. Se guarda cuando presiones Guardar.");
}

export function deletePaymentPlan(id) {
    if (!(hasPermission("paymentPlans.manage") || hasPermission("*"))) {
        toast("No tienes permiso para eliminar planes.");
        return;
    }
    if (!confirm("¿Eliminar plan de pago?")) return;
    state.paymentPlans = state.paymentPlans.filter(x => x.id !== id);
    saveState();
    rerenderPaymentPlansView();
    toast("Plan eliminado.");
    Promise.resolve().then(async () => {
        try {
            await deletePaymentPlanFromApi(id);
            paymentPlansApiSyncStarted = false;
            paymentPlansLastFetchKey = "";
            ensurePaymentPlansApiSyncOnce();
        } catch {
            toast("Se eliminó localmente, pero falló eliminar en la base de datos.");
        }
    });
}

export function viewPaymentPlan(id) {
    const p = state.paymentPlans.find(x => x.id === id);
    if (!p) return;
    openModal({
        title: "Ver plan de pago",
        bodyHtml: `
      <div class="card">
        <div class="row">
          <div>
            <strong>${escapeHtml(p.clientName || p.clientDisplay || "Plan de Pago")}</strong>
            <div class="kbd">${escapeHtml(p.tripName || p.tripDisplay || "")}</div>
          </div>
          <span class="badge">${escapeHtml(p.currency || "")}</span>
        </div>
        <hr/>
        <div class="field"><label>Texto</label><textarea readonly>${escapeHtml(p.text || "")}</textarea></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn" id="copyPlan">Copiar</button>
        </div>
      </div>
    `,
        onSave: () => closeModal()
    });
    document.getElementById("copyPlan").onclick = () => navigator.clipboard.writeText(p.text || "");
}

export function togglePlanMenu(ev, id) {
    ev.stopPropagation();
    const trigger = ev.target?.closest(".menu-trigger");
    window.closeAllDropdowns && window.closeAllDropdowns();
    const menu = document.getElementById(`plan-menu-${id}`);
    if (!menu) return;
    const wasOpen = !menu.hidden;
    closePlanMenus();
    if (wasOpen) return;

    menu.hidden = false;
    menu.style.display = "block";
    const actionMenu = trigger?.closest(".action-menu");
    if (actionMenu) actionMenu.classList.add("menu-open");
    const row = trigger?.closest("tr");
    if (row) row.classList.add("menu-open");
}

function closePlanMenus() {
    document.querySelectorAll("[id^='plan-menu-']").forEach(el => {
        el.hidden = true;
        el.style.display = "none";
    });
    document.querySelectorAll(".action-menu.menu-open").forEach(el => el.classList.remove("menu-open"));
    document.querySelectorAll(".table tbody tr.menu-open").forEach(el => el.classList.remove("menu-open"));
}

// Ensure clicking outside closes menus
document.addEventListener("click", (e) => {
    if (!e.target.closest(".action-menu")) {
        closePlanMenus();
    }
});

// PDF Generation Logic (Keep it here or move to pdfHelpers.js, but keeping here for cohesion as per original)

export function buildPaymentPlanPdfHTML(p) {
    const s = state.settings;
    const cliente = (p.clientName || p.clientDisplay || "Cliente");
    const viaje = (p.tripName || p.tripDisplay || "Viaje");
    const extra = p.extra || "";
    const currency = p.currency || "USD";
    const startISO = p.startDate;
    const endISO = p.endDate;
    const total = p.total || 0;
    const descuento = p.discount || 0;
    const reserva = p.deposit || 0;
    const freq = p.freq || "Mensual";
    const method = p.method || "Transferencia";
    const link = p.paymentLink || "";

    const totalDesc = round2(total - descuento);
    const restante = round2(totalDesc - reserva);

    const dates = buildScheduleDates({ startISO, endISO, frequency: freq });
    const cuotas = dates.length || 0;
    const montos = cuotas ? splitInstallments(restante, cuotas) : [];

    const montoCuotaBase = cuotas ? montos[0] : 0;
    const feePct = Number(s.cardFeePct || 0);
    const montoCuotaTarjeta = round2(montoCuotaBase * (1 + (feePct / 100)));

    const titulo = `Plan de Pagos Para el Viaje a ${escapeHtml(viaje)}${extra ? " " + escapeHtml(extra) : ""}`;
    const fechaGen = new Date().toLocaleDateString(s.locale);

    const kv = (k, v) => `<tr class="pdf-tr"><td class="pdf-k">${k}</td><td class="pdf-v">${v}</td></tr>`;

    let fechasListHtml = "";
    dates.forEach((d, i) => {
        const montoCuota = montos[i] ?? montoCuotaBase;
        fechasListHtml += `
          <li>
            <div class="pdf-pay-left">
              <span><b>${ordinalPago(i)} pago:</b> ${formatDateLongISO(d)}</span>
              <span class="muted">Cuota ${i + 1} de ${cuotas || 1}</span>
            </div>
            <span class="amt">${escapeHtml(toMoney(montoCuota, currency))}</span>
          </li>
        `;
    });

    const isLongSchedule = dates.length > 8;

    let notaTarjeta = "";
    if (method === "Tarjeta") {
        notaTarjeta = `
      <div class="pdf-note-box">
        <div class="pdf-note-title">Nota Importante</div>
        <p><strong>Costo Adicional:</strong> El monto por cuota es de <strong>${escapeHtml(toMoney(montoCuotaTarjeta, currency))}</strong> debido a un cargo adicional de <strong>${feePct}%</strong> por el uso de tarjeta de crédito/débito. Este cargo cubre los costos de procesamiento.</p>
        <p><strong>Fechas específicas:</strong> Las fechas indicadas son las programadas para sus pagos. Si necesita realizar algún ajuste, contáctenos a la brevedad.</p>
        <p><strong>Atención personalizada:</strong> Nuestro equipo está a su disposición para aclarar cualquier duda.</p>
      </div>
    `;
    }

    const logoImg = s.logoDataUrl || ""; // Or define default logo if needed
    const logoHtml = logoImg ? `<img src="${logoImg}" class="pdf-logo" alt="logo" />` : `<div class="pdf-logo-text">${escapeHtml(s.companyName)}</div>`;

    const brandLine = escapeHtml(s.companyName);
    const subLine = "Travel & Concierge Services";

    // CSS for PDF (inline)
    // We rely on the global CSS or specific PDF css injected by html2pdf if needed.
    // But here we construct HTML to be printed.

    const renderDatesList = (list, offset = 0) => list.map((d, i) => {
        const idx = offset + i;
        const montoCuota = montos[idx] ?? montoCuotaBase;
        return `
          <li>
            <div class="pdf-pay-left">
              <span><b>${ordinalPago(idx)} pago:</b> ${formatDateLongISO(d)}</span>
              <span class="muted">Cuota ${idx + 1} de ${cuotas || 1}</span>
            </div>
            <span class="amt">${escapeHtml(toMoney(montoCuota, currency))}</span>
          </li>
        `;
    }).join("");

    const longFirstPageCount = Math.min(10, Math.ceil(dates.length * 0.65));
    const datesPage1 = dates.slice(0, longFirstPageCount);
    const datesPage2 = dates.slice(longFirstPageCount);

    const footerBlock = `
      <div class="pdf-footer">
        <div><strong>${escapeHtml(s.companyName || "Brianessa Travel")}</strong></div>
        <div>Teléfono: ${escapeHtml(s.phone || "")} | Correo: ${escapeHtml(s.email || "")}</div>
        <div>Instagram: ${escapeHtml(s.instagram || "")} | Facebook: ${escapeHtml(s.facebook || "")}</div>
        <div>Web: ${escapeHtml(s.website || "")}</div>
      </div>
    `;

    const PAYMENT_PLAN_PDF_STYLES = `
  .pdf-wrap { width: 100%; }
  .pdf-page {
    font-family: Arial, Helvetica, sans-serif;
    color: #111827;
    background: #ffffff;
    width: 100%;
    min-height: 1060px;
    box-sizing: border-box;
    padding: 14px 16px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
  }
  .pdf-page + .pdf-page {
    margin-top: 12px;
    page-break-before: always;
    break-before: page;
  }
  .pdf-page .pdf-body {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .pdf-page .pdf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid #111827;
    padding-bottom: 8px;
  }
  .pdf-page .pdf-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pdf-page .pdf-logo {
    width: 56px;
    height: 56px;
    object-fit: contain;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #fff;
    padding: 4px;
  }
  .pdf-page .pdf-logo-text {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 12px;
  }
  .pdf-page .pdf-brand {
    font-size: 14px;
    font-weight: 900;
    line-height: 1.15;
    color: #111827;
  }
  .pdf-page .pdf-subbrand {
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
  }
  .pdf-page .pdf-meta-top {
    font-size: 12px;
    font-weight: 800;
    color: #111827;
  }
  .pdf-page .pdf-title {
    margin: 8px 0 6px;
    font-size: 17px;
    font-weight: 900;
    line-height: 1.2;
  }
  .pdf-page .pdf-intro {
    margin: 0 0 8px;
    font-size: 11.5px;
    line-height: 1.4;
    color: #111827;
  }
  .pdf-page .pdf-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: stretch;
  }
  .pdf-page .pdf-grid.onecol {
    grid-template-columns: 1fr;
  }
  .pdf-page .pdf-card {
    border: 1px solid #000;
    border-radius: 14px;
    padding: 9px;
    background: #fff;
    display: flex;
    flex-direction: column;
    page-break-inside: avoid;
  }
  .pdf-page .pdf-card-title {
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
    margin: 0 0 8px;
  }
  .pdf-page .pdf-kv {
    width: 100%;
    border-collapse: collapse;
  }
  .pdf-page .pdf-kv td {
    border-bottom: 1px solid #e5e7eb;
    padding: 5px 0;
    vertical-align: top;
    font-size: 11px;
  }
  .pdf-page .pdf-kv tr:last-child td {
    border-bottom: none;
  }
  .pdf-page .pdf-kv td.k {
    width: 62%;
    color: #374151;
    font-weight: 700;
  }
  .pdf-page .pdf-kv td.v {
    width: 38%;
    color: #111827;
    font-weight: 900;
    text-align: right;
  }
  .pdf-page .pdf-subtitle {
    margin: 7px 0 4px;
    font-size: 11.5px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .pdf-page .pdf-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid #e5e7eb;
  }
  .pdf-page .pdf-list li {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px dashed #e5e7eb;
    font-size: 11px;
  }
  .pdf-page .pdf-list li:last-child {
    border-bottom: none;
  }
  .pdf-page .pdf-pay-left {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .pdf-page .muted {
    color: #6b7280;
    font-size: 10.5px;
    font-weight: 700;
  }
  .pdf-page .amt {
    white-space: nowrap;
    font-weight: 900;
    color: #111827;
    font-size: 11px;
    padding-top: 1px;
  }
  .pdf-page .pdf-paylink {
    margin-top: 12px;
    border: 1px solid #000;
    border-radius: 12px;
    padding: 9px;
    background: #f9fafb;
  }
  .pdf-page .pdf-paylink.after-calendar {
    margin-top: 16px;
  }
  .pdf-page .pdf-paylink-title {
    font-size: 11px;
    font-weight: 900;
    margin-bottom: 4px;
  }
  .pdf-page .pdf-paylink-url {
    font-size: 11px;
    line-height: 1.35;
    color: #1d4ed8;
    word-break: break-word;
    font-weight: 700;
  }
  .pdf-page .pdf-note-box {
    margin-top: 10px;
    border: 1px solid #000;
    border-radius: 12px;
    padding: 9px 10px;
    background: #fff7ed;
    page-break-inside: avoid;
  }
  .pdf-page .pdf-note-title {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 900;
  }
  .pdf-page .pdf-note-box p {
    margin: 4px 0;
    font-size: 11px;
    line-height: 1.35;
  }
  .pdf-page .pdf-footer {
    margin-top: auto;
    border-top: 1px solid #111827;
    padding-top: 8px;
    text-align: center;
    font-size: 10px;
    line-height: 1.25;
    color: #111827;
  }
  `;

    if (isLongSchedule) {
        return `
  <div class="pdf-wrap">
    <style>${PAYMENT_PLAN_PDF_STYLES}</style>
    <div class="pdf-page long-schedule">
      <div class="pdf-header">
        <div class="pdf-header-left">
          ${logoHtml}
          <div class="pdf-headtext">
            <div class="pdf-brand">${brandLine}</div>
            <div class="pdf-subbrand">${subLine}</div>
          </div>
        </div>
        <div class="pdf-meta-top"><div class="pdf-date">Fecha: ${escapeHtml(fechaGen)}</div></div>
      </div>
      <div class="pdf-title">${titulo}</div>
      <div class="pdf-body">
        <div class="pdf-intro">
          <b>Estimada, ${escapeHtml(cliente)}:</b><br/>
          Nos complace proporcionarle las opciones de pago personalizadas para completar el monto pendiente de su viaje a ${escapeHtml(viaje)}${extra ? " " + escapeHtml(extra) : ""}.
        </div>
        <div class="pdf-grid onecol">
          <div class="pdf-card client-card">
            <div class="pdf-card-title">Datos del Cliente</div>
            <table class="pdf-kv">
              ${kv("Nombre del Cliente", escapeHtml(cliente))}
              ${kv("Viaje", escapeHtml(viaje))}
              ${kv("Monto Total del Viaje", escapeHtml(toMoney(total, currency)))}
              ${kv("Descuento aplicado", escapeHtml(toMoney(descuento, currency)))}
              ${kv("Monto con Descuento", escapeHtml(toMoney(totalDesc, currency)))}
              ${kv("Monto de Reservación", escapeHtml(toMoney(reserva, currency)) + " (ya pagado)")}
              ${kv("Monto Pendiente Final", escapeHtml(toMoney(restante, currency)))}
              ${kv("Fecha de Inicio de Pago", escapeHtml(formatDateLongISO(startISO)))}
              ${kv("Fecha Final de Pago", escapeHtml(formatDateLongISO(endISO)))}
            </table>
          </div>
          <div class="pdf-card pay-card">
            <div class="pdf-card-title">Calendario de Pagos (${escapeHtml(freq)})</div>
            <table class="pdf-kv">
              ${kv("Cantidad de Cuotas", escapeHtml(String(cuotas)))}
              ${kv("Monto base por Cuota", escapeHtml(toMoney(montoCuotaBase, currency)))}
            </table>
            <div class="pdf-subtitle">Fechas de Pago</div>
            <ul class="pdf-list">${renderDatesList(datesPage1, 0)}</ul>
          </div>
        </div>
      </div>
      ${footerBlock}
    </div>
    <div class="pdf-page long-schedule">
      <div class="pdf-header">
        <div class="pdf-header-left">
          ${logoHtml}
          <div class="pdf-headtext">
            <div class="pdf-brand">${brandLine}</div>
            <div class="pdf-subbrand">${subLine}</div>
          </div>
        </div>
        <div class="pdf-meta-top"><div class="pdf-date">Fecha: ${escapeHtml(fechaGen)}</div></div>
      </div>
      <div class="pdf-title">${titulo} (Continuación)</div>
      <div class="pdf-body">
        <div class="pdf-grid onecol">
          <div class="pdf-card pay-card">
            <div class="pdf-card-title">Calendario de Pagos (${escapeHtml(freq)})</div>
            <div class="pdf-subtitle">Fechas de Pago</div>
            <ul class="pdf-list">${renderDatesList(datesPage2, datesPage1.length)}</ul>
            <div class="pdf-paylink after-calendar">
              <div class="pdf-paylink-title">👉 Realiza tus pagos aquí</div>
              <div class="pdf-paylink-url">${escapeHtml(link || "(pendiente de link)")}</div>
            </div>
          </div>
        </div>
        ${notaTarjeta}
      </div>
      ${footerBlock}
    </div>
  </div>
  `;
    }

    return `
  <div class="pdf-wrap">
    <style>${PAYMENT_PLAN_PDF_STYLES}</style>
    <div class="pdf-page short-schedule">
      <div class="pdf-header">
        <div class="pdf-header-left">
          ${logoHtml}
          <div class="pdf-headtext">
            <div class="pdf-brand">${brandLine}</div>
            <div class="pdf-subbrand">${subLine}</div>
          </div>
        </div>
        <div class="pdf-meta-top"><div class="pdf-date">Fecha: ${escapeHtml(fechaGen)}</div></div>
      </div>
      <div class="pdf-title">${titulo}</div>
      <div class="pdf-body">
        <div class="pdf-intro">
          <b>Estimada, ${escapeHtml(cliente)}:</b><br/>
          Nos complace proporcionarle las opciones de pago personalizadas para completar el monto pendiente de su viaje a ${escapeHtml(viaje)}${extra ? " " + escapeHtml(extra) : ""}.
        </div>
        <div class="pdf-grid">
          <div class="pdf-card client-card">
            <div class="pdf-card-title">Datos del Cliente</div>
            <table class="pdf-kv">
              ${kv("Nombre del Cliente", escapeHtml(cliente))}
              ${kv("Viaje", escapeHtml(viaje))}
              ${kv("Monto Total del Viaje", escapeHtml(toMoney(total, currency)))}
              ${kv("Descuento aplicado", escapeHtml(toMoney(descuento, currency)))}
              ${kv("Monto con Descuento", escapeHtml(toMoney(totalDesc, currency)))}
              ${kv("Monto de Reservación", escapeHtml(toMoney(reserva, currency)) + " (ya pagado)")}
              ${kv("Monto Pendiente Final", escapeHtml(toMoney(restante, currency)))}
              ${kv("Fecha de Inicio de Pago", escapeHtml(formatDateLongISO(startISO)))}
              ${kv("Fecha Final de Pago", escapeHtml(formatDateLongISO(endISO)))}
            </table>
          </div>
          <div class="pdf-card pay-card">
            <div class="pdf-card-title">Modalidades de Pago ${escapeHtml(freq)}</div>
            <table class="pdf-kv">
              ${kv("Cantidad de Cuotas", escapeHtml(String(cuotas)))}
              ${kv("Monto por Cuota", escapeHtml(toMoney(montoCuotaBase, currency)))}
            </table>
            <div class="pdf-subtitle">Fechas de Pago</div>
            <ul class="pdf-list">${renderDatesList(dates, 0)}</ul>
            <div class="pdf-paylink">
              <div class="pdf-paylink-title">👉 Realiza tus pagos aquí</div>
              <div class="pdf-paylink-url">${escapeHtml(link || "(pendiente de link)")}</div>
            </div>
          </div>
        </div>
        ${notaTarjeta}
      </div>
      ${footerBlock}
    </div>
  </div>
  `;
}

export function previewPaymentPlanPDF(id) {
    return generatePaymentPlanPDF(id, "preview");
}

export function exportPaymentPlanPDF(id) {
    return generatePaymentPlanPDF(id, "download");
}

function buildPaymentPlanFilename(p) {
    const toFileLabel = (value, fallback) => {
        const raw = (value || fallback).toString().trim();
        return raw
            .replace(/[\\/:*?"<>|]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    };
    const clientLabel = toFileLabel(p.clientName || p.clientDisplay, "Cliente");
    const tripLabel = toFileLabel(p.tripName || p.tripDisplay, "Viaje");
    return `Plan de Pago - ${clientLabel} - ${tripLabel}.pdf`;
}

async function generatePaymentPlanPDF(id, mode = "download") {
    const p = state.paymentPlans.find(x => x.id === id);
    if (!p) { toast("No encontré ese plan."); return; }

    try {
        if (!window.html2pdf) {
            exportPaymentPlanPDF_fallback(p);
            return;
        }

        const root = document.getElementById("pdf-root");
        if (!root) { toast("Falta el contenedor #pdf-root."); return; }

        root.innerHTML = buildPaymentPlanPdfHTML(p);
        const element = root.firstElementChild;

        const filename = buildPaymentPlanFilename(p);

        const opt = {
            margin: [18, 18, 18, 18],
            filename: filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
            jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["css", "legacy"] }
        };

        if (mode === "preview") {
            const pdfBlob = await html2pdf().set(opt).from(element).outputPdf("blob");
            const url = URL.createObjectURL(pdfBlob);
            root.innerHTML = "";

            openModal({
                title: "Vista previa del plan de pago",
                bodyHtml: `
                  <div class="card" style="padding:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                      <div class="kbd">Revisa el documento antes de descargarlo.</div>
                      <button class="btn primary" id="btnPlanPreviewDownload">Descargar PDF</button>
                    </div>
                    <iframe
                      src="${url}"
                      style="width:100%; height:70vh; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:#fff;"
                      title="Vista previa PDF plan de pago"
                    ></iframe>
                  </div>
                `,
                onSave: () => {
                    URL.revokeObjectURL(url);
                    closeModal();
                }
            });

            const btn = document.getElementById("btnPlanPreviewDownload");
            if (btn) {
                btn.onclick = () => {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                };
            }
            toast("Vista previa lista ✅");
            return;
        }

        await html2pdf().set(opt).from(element).save();
        root.innerHTML = "";
        toast("PDF plan descargado ✅");
    } catch (e) {
        console.error(e);
        const root = document.getElementById("pdf-root");
        if (root) root.innerHTML = "";
        exportPaymentPlanPDF_fallback(p);
    }
}

function exportPaymentPlanPDF_fallback(p) {
    let text = (p.text || "").trim();
    if (!text) {
        text = `Plan de pago para ${p.clientName || "Cliente"}\nTotal: ${p.total}`;
    }
    if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(text, 10, 10);
        doc.save(buildPaymentPlanFilename(p));
    } else {
        alert("No se puede generar PDF (librerías faltantes).");
    }
}

export function attachPaymentPlan(id) {
    const p = state.paymentPlans.find(x => x.id === id);
    if (!p) { toast("No encontré ese plan."); return; }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        if (file.type !== "application/pdf") { toast("Solo PDF."); return; }

        const reader = new FileReader();
        reader.onload = () => {
            p.attachmentPdf = {
                name: file.name || "plan_pago.pdf",
                type: file.type,
                size: file.size,
                dataUrl: reader.result,
                attachedAt: new Date().toISOString()
            };
            saveState();
            rerenderPaymentPlansView();
            syncPaymentPlanInBackground(p);
            toast("PDF adjuntado ✅");
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

export function generateAndAttachPaymentPlanPDF(id) {
    const p = state.paymentPlans.find(x => x.id === id);
    if (!p) { toast("No encontré ese plan."); return; }

    if (!window.html2pdf) { toast("No tengo librería PDF."); return; }

    const root = document.getElementById("pdf-root");
    root.innerHTML = buildPaymentPlanPdfHTML(p);
    const element = root.firstElementChild;

    const opt = {
        margin: [18, 18, 18, 18],
        filename: "temp.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }
    };

    html2pdf().set(opt).from(element).outputPdf('datauristring')
        .then((pdfAsString) => {
            p.attachmentPdf = {
                name: buildPaymentPlanFilename(p),
                type: "application/pdf",
                size: pdfAsString.length, // approximation
                dataUrl: pdfAsString,
                attachedAt: new Date().toISOString()
            };
            saveState();
            root.innerHTML = "";
            rerenderPaymentPlansView();
            syncPaymentPlanInBackground(p);
            toast("PDF generado y adjuntado ✅");
        })
        .catch(err => {
            console.error(err);
            root.innerHTML = "";
            toast("Error generando PDF interno.");
        });
}

export function previewPaymentPlanAttachment(id) {
    const p = state.paymentPlans.find(x => x.id === id);
    if (!p || !p.attachmentPdf) return;
    const win = window.open("");
    win.document.write(`<iframe src="${p.attachmentPdf.dataUrl}" style="width:100%;height:100vh;border:0;"></iframe>`);
}

export function downloadPaymentPlanAttachment(id) {
    const p = state.paymentPlans.find(x => x.id === id);
    if (!p || !p.attachmentPdf) return;
    const a = document.createElement("a");
    a.href = p.attachmentPdf.dataUrl;
    a.download = p.attachmentPdf.name;
    a.click();
}

export function removePaymentPlanAttachment(id) {
    const p = state.paymentPlans.find(x => x.id === id);
    if (p) {
        p.attachmentPdf = null;
        saveState();
        rerenderPaymentPlansView();
        syncPaymentPlanInBackground(p);
    }
}
