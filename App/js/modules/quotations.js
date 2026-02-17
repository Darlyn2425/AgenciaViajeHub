import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal, icon, toast } from "../utils/ui.js";
import { escapeHtml, matchesSearch, uid, parseNum, toMoney, formatDateLongISO } from "../utils/helpers.js";
import { withTenantQuery, tenantHeaders } from "../utils/tenant.js";
import { hasPermission } from "../core/auth.js";
import { getTenantItems, findTenantItem, pushTenantItem } from "../utils/tenant-data.js";

// Expose minimal window API for onclick handlers
window.viewQuotation = editQuotation;
window.editQuotation = editQuotation;
window.duplicateQuotation = duplicateQuotation;
window.deleteQuotation = deleteQuotation;
window.exportQuotationPDF = exportQuotationPDF;
window.previewQuotationPDF = previewQuotationPDF;
window.runQuotationAction = runQuotationAction;
window.toggleQuotationMenu = toggleQuotationMenu;
window.openQuotationModal = openQuotationModal;
window.convertQuotationToItinerary = convertQuotationToItinerary;

let quotationPdfBusy = false;
let quotationsApiSyncStarted = false;
let quotationsApiSyncCompleted = false;
const API_TIMEOUT_MS = 8000;
const QUOTATIONS_PAGE_SIZE = 20;
let quotationsPage = 1;
let quotationsLastSearchTerm = "";
let quotationsTotal = 0;
let quotationsLastFetchKey = "";
let quotationsIsLoading = false;

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchQuotationsFromApi({ page = 1, limit = QUOTATIONS_PAGE_SIZE, search = "" } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search: String(search || ""),
  });
  const response = await fetchWithTimeout(withTenantQuery(`/api/quotations?${params.toString()}`), {
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
    totalPages: Number(pagination.totalPages || 1),
  };
}

async function upsertQuotationToApi(quotation) {
  const response = await fetchWithTimeout(withTenantQuery("/api/quotations"), {
    method: "POST",
    headers: tenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(quotation || {}),
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
    console.warn("[quotations] auto-client sync warning:", error?.message || error);
  });
}

async function deleteQuotationFromApi(id) {
  const response = await fetchWithTimeout(withTenantQuery(`/api/quotations?id=${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: tenantHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || data?.deleted !== true) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

async function upsertItineraryToApi(itinerary) {
  const response = await fetchWithTimeout(withTenantQuery("/api/itineraries"), {
    method: "POST",
    headers: tenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(itinerary || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data?.item) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data.item;
}

async function ensureQuotationsApiSyncOnce() {
  const fetchKey = `${quotationsPage}|${quotationsLastSearchTerm}`;
  if (quotationsIsLoading || (quotationsApiSyncStarted && quotationsLastFetchKey === fetchKey)) return;
  quotationsApiSyncStarted = true;
  quotationsIsLoading = true;
  quotationsLastFetchKey = fetchKey;
  try {
    const remote = await fetchQuotationsFromApi({ page: quotationsPage, limit: QUOTATIONS_PAGE_SIZE, search: quotationsLastSearchTerm });
    state.quotations = remote.items;
    quotationsTotal = remote.total;
    saveState();
    quotationsApiSyncCompleted = true;
    rerenderQuotationsView();
  } catch {
    quotationsApiSyncStarted = false;
  } finally {
    quotationsIsLoading = false;
  }
}

function getConfiguredQuotationStatuses() {
  const list = state.settings?.modules?.quotations?.statuses || [];
  if (list.length) return list;
  return [{ id: "quo_draft", label: "Borrador", color: "#64748b", isDefault: true, isFinal: false, order: 1 }];
}

function getDefaultQuotationStatus() {
  const statuses = getConfiguredQuotationStatuses();
  return statuses.find(s => s.isDefault) || statuses[0];
}

function getActiveRoute() {
  return document.querySelector(".nav-item.active")?.dataset?.route || "";
}

function getCurrentSearchTermFromInput() {
  const input = document.getElementById("globalSearch") || document.getElementById("searchInput");
  return (input?.value || "").toLowerCase();
}

function rerenderQuotationsView() {
  if (getActiveRoute() === "quotations") {
    renderQuotations(getCurrentSearchTermFromInput());
    return;
  }
  if (window.render) window.render();
}

function goToQuotationsPage(page) {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  quotationsPage = safePage;
  quotationsApiSyncStarted = false;
  rerenderQuotationsView();
}

window.goToQuotationsPage = goToQuotationsPage;

// Helper for image resizing (max 800x600 to save space)
function resizeImage(file) {
  const MAX_WIDTH = 640;
  const MAX_HEIGHT = 480;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.58));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function recompressDataUrl(dataUrl, { maxWidth = 640, maxHeight = 480, quality = 0.55 } = {}) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      resolve(dataUrl || "");
      return;
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      } else {
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function uploadImageToBlob(file, { fallbackToBase64 = true } = {}) {
  const form = new FormData();
  form.append("file", file);
  try {
    const response = await fetch("/api/uploads/image", {
      method: "POST",
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.file?.url) {
      const reason = data?.error || `HTTP ${response.status}`;
      throw new Error(reason);
    }
    return data.file.url;
  } catch (error) {
    if (!fallbackToBase64) {
      throw error;
    }
    return resizeImage(file);
  }
}

function toRichEditableHtml(value = "") {
  return escapeHtml(String(value || ""));
}

async function compactAllQuotationsForStorage({ keepQuotationId = "" } = {}) {
  if (!Array.isArray(state.quotations)) return;
  for (const q of state.quotations) {
    const isCurrent = keepQuotationId && q.id === keepQuotationId;
    const imgLimit = isCurrent ? 4 : 2;
    const dayLimit = isCurrent ? 6 : 3;

    q.images = await Promise.all(
      (Array.isArray(q.images) ? q.images : [])
        .slice(0, imgLimit)
        .map(src => recompressDataUrl(src, { maxWidth: isCurrent ? 520 : 420, maxHeight: isCurrent ? 390 : 320, quality: isCurrent ? 0.42 : 0.34 }))
    );

    if (Array.isArray(q.itineraryDays)) {
      const trimmedDays = q.itineraryDays.slice(0, Math.max(q.itineraryDays.length, dayLimit));
      q.itineraryDays = await Promise.all(trimmedDays.map(async (d, idx) => ({
        ...d,
        image: (idx < dayLimit && d.image)
          ? await recompressDataUrl(d.image, { maxWidth: isCurrent ? 420 : 340, maxHeight: isCurrent ? 320 : 250, quality: isCurrent ? 0.40 : 0.30 })
          : ""
      })));
    }
  }
}

// Render logic
export function renderQuotations(searchTerm = "") {
  if (searchTerm !== quotationsLastSearchTerm) {
    quotationsPage = 1;
    quotationsLastSearchTerm = searchTerm;
    quotationsApiSyncStarted = false;
  }
  if (!quotationsApiSyncCompleted || !quotationsApiSyncStarted) {
    ensureQuotationsApiSyncOnce();
  }
  const canManage = hasPermission("quotations.manage") || hasPermission("*");
  const statuses = getConfiguredQuotationStatuses();
  const getStatus = (q) => statuses.find(s => s.id === q.statusId) || getDefaultQuotationStatus();
  const filtered = state.quotations;
  const totalPages = Math.max(1, Math.ceil((quotationsTotal || filtered.length) / QUOTATIONS_PAGE_SIZE));
  if (quotationsPage > totalPages) quotationsPage = totalPages;
  const pageStart = (quotationsPage - 1) * QUOTATIONS_PAGE_SIZE;
  const pageItems = filtered;
  const rows = pageItems.map(q => {
    const status = getStatus(q);
    const menuItems = `
      <button class="menu-item" onclick="window.runQuotationAction('preview','${q.id}')">
        <span class="mi-ic">${icon('eye')}</span>
        <span class="mi-tx">Ver PDF</span>
      </button>
      <div class="menu-sep"></div>
      <button class="menu-item" onclick="window.runQuotationAction('download','${q.id}')">
        <span class="mi-ic">${icon('download')}</span>
        <span class="mi-tx">Descargar (PDF)</span>
      </button>
      <div class="menu-sep"></div>
      ${canManage ? `<button class="menu-item" onclick="window.convertQuotationToItinerary('${q.id}')">
        <span class="mi-ic">${icon('copy')}</span>
        <span class="mi-tx">Convertir a itinerario</span>
      </button>
      <div class="menu-sep"></div>` : ``}
      ${canManage ? `<button class="menu-item" onclick="window.duplicateQuotation('${q.id}')">
        <span class="mi-ic">${icon('copy')}</span>
        <span class="mi-tx">Duplicar</span>
      </button>
      <div class="menu-sep"></div>
      <button class="menu-item danger" onclick="window.deleteQuotation('${q.id}')">
        <span class="mi-ic">${icon('trash')}</span>
        <span class="mi-tx">Eliminar</span>
      </button>` : ``}
    `;

    return `
      <tr>
        <td>
          <div class="plan-cell">
            <div class="plan-main">
              <strong>${escapeHtml(q.destination || "Cotización")}</strong>
            </div>
            <div class="kbd">${escapeHtml(q.clientName || q.clientDisplay || "Cliente")}</div>
            <div style="margin-top:6px;">
              <span class="status-chip" style="--status-color:${escapeHtml(status.color || "#64748b")}">${escapeHtml(status.label || "Estado")}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(q.datesText || "")}</td>
        <td>${toMoney(q.total || 0, q.currency)}</td>
        <td>
          <div class="actions compact">
            ${canManage ? `<button class="icon-btn" onclick="window.viewQuotation('${q.id}')" title="Ver">${icon('eye')}</button>
            <button class="icon-btn" onclick="window.editQuotation('${q.id}')" title="Editar">${icon('edit')}</button>` : ``}
            
            <div class="action-menu" data-menu="${q.id}">
              <button class="icon-btn menu-trigger" onclick="window.toggleQuotationMenu(event,'${q.id}')">${icon('dots')}</button>
              <div class="menu-pop" id="quo-menu-${q.id}" hidden>
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
      ${renderModuleToolbar("quotations",
    `<div><h2 style="margin:0;">Cotizaciones</h2><div class="kbd">Crea presupuestos detallados con vuelos, hotel y traslados.</div></div>`,
    `${canManage ? `<button class="btn primary" onclick="window.openQuotationModal()">+ Nueva cotización</button>` : ``}`
  )}
      <hr/>
      <table class="table">
        <thead><tr><th>Destino</th><th>Fechas</th><th>Total</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">${quotationsIsLoading ? "Cargando cotizaciones..." : "No hay cotizaciones todavía."}</td></tr>`}</tbody>
      </table>
      <div class="row" style="margin-top:10px;">
        <div class="kbd">Mostrando ${quotationsTotal ? pageStart + 1 : 0}-${Math.min(pageStart + QUOTATIONS_PAGE_SIZE, quotationsTotal || filtered.length)} de ${quotationsTotal || filtered.length}</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn" ${quotationsPage <= 1 ? "disabled" : ""} onclick="window.goToQuotationsPage(${quotationsPage - 1})">Anterior</button>
          <div class="kbd">Página ${quotationsPage} / ${totalPages}</div>
          <button class="btn" ${quotationsPage >= totalPages ? "disabled" : ""} onclick="window.goToQuotationsPage(${quotationsPage + 1})">Siguiente</button>
        </div>
      </div>
    </div>
  `);
}

function toggleQuotationMenu(e, id) {
  e.stopPropagation();
  const trigger = e.target?.closest(".menu-trigger");
  const menu = document.getElementById(`quo-menu-${id}`);
  if (!menu) return;
  const wasOpen = !menu.hidden;
  closeQuotationMenus();
  if (wasOpen) return;
  const willOpen = true;
  menu.hidden = !willOpen;
  menu.style.display = willOpen ? "block" : "none";
  const actionMenu = trigger?.closest(".action-menu");
  if (actionMenu) actionMenu.classList.add("menu-open");
  const row = trigger?.closest("tr");
  if (row) row.classList.add("menu-open");
}

function closeQuotationMenus() {
  document.querySelectorAll("[id^='quo-menu-']").forEach(el => {
    el.hidden = true;
    el.style.display = "none";
  });
  document.querySelectorAll(".action-menu.menu-open").forEach(el => el.classList.remove("menu-open"));
  document.querySelectorAll(".table tbody tr.menu-open").forEach(el => el.classList.remove("menu-open"));
}

function runQuotationAction(action, id) {
  closeQuotationMenus();
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  if (action === "preview") previewQuotationPDF(id);
  else exportQuotationPDF(id);
}

// Close menus on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".action-menu")) {
    closeQuotationMenus();
  }
});


// Modal Logic
export function openQuotationModal(existing = null) {
  if (!(hasPermission("quotations.manage") || hasPermission("*"))) {
    toast("No tienes permiso para modificar cotizaciones.");
    return;
  }
  const MAX_QUOTATION_IMAGES = 6;
  const isEditing = !!existing && !existing.__draftDuplicate;
  const quotationStatuses = getConfiguredQuotationStatuses();
  const defaultStatus = getDefaultQuotationStatus();
  const currentStatusId = existing?.statusId || defaultStatus.id;
  const clientOptions = getTenantItems("clients")
    .map(c => `<option value="${escapeHtml(c.name)}"></option>`)
    .join("");

  // Default data structure
  const d = existing || {
    currency: "USD",
    adults: 2,
    children: 0,
    pricePerPerson: 0,
    totalGroup: 0,
    images: [],
    itineraryEnabled: false,
    itineraryDays: []
  };

  // Local state for images in this modal session
  let currentImages = (d.images || []).slice(0, MAX_QUOTATION_IMAGES);
  const renderImageThumbs = () => currentImages.map((src, i) => `
    <div style="position:relative; display:inline-block;">
      <img src="${src}" style="height:80px; border-radius:8px; border:1px solid #ccc; display:block;">
      <div style="position:absolute; left:4px; top:4px; display:flex; gap:4px;">
        <button
          type="button"
          class="icon-btn q-img-move-left"
          data-index="${i}"
          title="Mover a la izquierda"
          style="width:22px; height:22px; min-width:22px; border-radius:999px; background:rgba(0,0,0,.65); color:#fff;"
        >←</button>
        <button
          type="button"
          class="icon-btn q-img-move-right"
          data-index="${i}"
          title="Mover a la derecha"
          style="width:22px; height:22px; min-width:22px; border-radius:999px; background:rgba(0,0,0,.65); color:#fff;"
        >→</button>
      </div>
      <button
        type="button"
        class="icon-btn q-img-remove"
        data-index="${i}"
        title="Quitar imagen"
        style="position:absolute; top:4px; right:4px; width:22px; height:22px; min-width:22px; border-radius:999px; background:rgba(0,0,0,.65); color:#fff;"
      >✕</button>
    </div>
  `).join("");

  const itineraryDays = Array.isArray(d.itineraryDays) ? d.itineraryDays : [];
  const renderItineraryDayRow = (day = {}, idx = 0) => `
    <div class="q-it-day-item">
      <div class="grid">
        <div class="field col-4">
          <label>Día</label>
          <input class="q-it-day-label" value="${escapeHtml(day.day || `DÍA ${idx + 1}`)}" placeholder="Ej: DÍA 1" />
        </div>
        <div class="field col-8">
          <label>Título</label>
          <input class="q-it-day-title" value="${escapeHtml(day.title || "")}" placeholder="Ej: AMÉRICA - MILAN" />
        </div>
      </div>
      <div class="grid">
        <div class="field col-8">
          <label>Texto del día</label>
          <textarea class="q-it-day-text" rows="4" placeholder="Describe las actividades del día...">${toRichEditableHtml(day.text || day.content || "")}</textarea>
        </div>
        <div class="field col-4">
          <label>Comidas incluidas</label>
          <input class="q-it-day-meals" value="${escapeHtml(day.meals || "")}" placeholder="Ej: Desayuno" />
          <label style="margin-top:8px;">Imagen del día</label>
          <input class="q-it-day-image-file" type="file" accept="image/*" />
          <input class="q-it-day-image-value" type="hidden" value="${escapeHtml(day.image || "")}" />
          <div class="q-it-day-image-preview-wrap">
            ${day.image ? `<img class="q-it-day-image-preview" src="${day.image}" />` : `<div class="kbd">Sin imagen</div>`}
          </div>
        </div>
      </div>
      <div class="q-it-day-actions">
        <button type="button" class="btn danger q-it-day-remove">Quitar día</button>
      </div>
    </div>
  `;

  openModal({
    title: isEditing ? "Editar cotización" : "Nueva cotización",
    bodyHtml: `
      <div class="form-layout form-layout--quotation">
        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">1</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Cliente</h4>
              <p class="form-section__hint">Empieza por el cliente. Si no existe, se crea al guardar.</p>
            </div>
          </div>
          <div class="grid">
            <div class="field col-12">
              <label>Cliente (buscar o crear) <span class="req">*</span></label>
              <input
                id="qClientSearch"
                list="qClientList"
                autofocus
                value="${escapeHtml(d.clientName || d.clientDisplay || "")}"
                placeholder="Escribe para buscar. Si no existe, se creará al guardar."
              />
              <datalist id="qClientList">${clientOptions}</datalist>
              <div class="kbd" style="margin-top:6px;">Si el nombre no existe en clientes, se agrega automáticamente.</div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">2</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Datos del Viaje</h4>
              <p class="form-section__hint">Destino, fechas y pasajeros para calcular la cotización.</p>
            </div>
          </div>
          <div class="grid">
            <div class="field col-6">
              <label>Destino <span class="req">*</span></label>
              <input id="qDest" value="${escapeHtml(d.destination || "")}" placeholder="Ej: Punta Cana" />
            </div>
            <div class="field col-6">
                <label>Fecha Documento</label>
                <input id="qDocDate" type="date" value="${escapeHtml(d.docDate || new Date().toISOString().slice(0, 10))}" />
            </div>
          </div>

          <div class="grid">
            <div class="field col-6">
              <label>Estado</label>
              <select id="qStatus">
                ${quotationStatuses.map(st => `<option value="${escapeHtml(st.id)}" ${st.id === currentStatusId ? "selected" : ""}>${escapeHtml(st.label)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="grid">
            <div class="field col-6"><label>Llegada <span class="req">*</span></label><input id="qStart" type="date" value="${escapeHtml(d.startDate || "")}" onchange="calcDates()" /></div>
            <div class="field col-6"><label>Salida <span class="req">*</span></label><input id="qEnd" type="date" value="${escapeHtml(d.endDate || "")}" onchange="calcDates()" /></div>
          </div>

          <div class="grid">
            <div class="field col-4"><label>Chip Fechas (auto)</label><input id="qDatesText" value="${escapeHtml(d.datesText || "")}" readonly /></div>
            <div class="field col-4"><label>Duración (auto)</label><input id="qDuration" value="${escapeHtml(d.duration || "")}" readonly /></div>
            <div class="field col-2"><label>Adultos</label><input id="qAdults" type="number" value="${d.adults}" oninput="calcTotals()" /></div>
            <div class="field col-2"><label>Niños</label><input id="qChildren" type="number" value="${d.children}" oninput="calcTotals()" /></div>
          </div>

          <div class="field">
            <label>Texto Pasajeros (opcional)</label>
            <input id="qPaxText" value="${escapeHtml(d.paxText || "")}" placeholder="Ej: 2 adultos, 1 niño (pedrito)" />
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">3</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Precios</h4>
              <p class="form-section__hint">Completa las tarifas. El total y depósito se calculan automáticamente.</p>
            </div>
          </div>
          <div class="grid">
            <div class="field col-3">
              <label>Moneda</label>
              <select id="qCurrency" onchange="calcTotals()">
                <option value="USD" ${d.currency === "USD" ? "selected" : ""}>USD</option>
                <option value="DOP" ${d.currency === "DOP" ? "selected" : ""}>DOP</option>
              </select>
            </div>
            <div class="field col-3"><label>Precio Adulto</label><input id="qPriceAd" type="number" value="${d.priceAd || ""}" oninput="calcTotals()" /></div>
            <div class="field col-3"><label>Precio Niño</label><input id="qPriceCh" type="number" value="${d.priceCh || ""}" oninput="calcTotals()" /></div>
            <div class="field col-3"><label>% Depósito</label><input id="qDepPct" type="number" value="${d.depPct || ""}" oninput="calcTotals()" placeholder="Ej: 50" /></div>
          </div>

          <div class="grid">
            <div class="field col-4"><label>Total Grupo (Calculado)</label><input id="qTotal" readonly value="${toMoney(d.total || 0, d.currency)}" style="font-weight:bold" /></div>
            <div class="field col-4"><label>Por Persona (Promedio)</label><input id="qPerPerson" readonly value="${toMoney(d.pricePerPerson || 0, d.currency)}" /></div>
            <div class="field col-4"><label>Monto Depósito</label><input id="qDeposit" readonly value="${toMoney(d.deposit || 0, d.currency)}" /></div>
          </div>

          <div class="field">
            <label>Nota Precios</label>
            <input id="qPriceNote" value="${escapeHtml(d.priceNote || "Tarifas sujetas a disponibilidad aérea y hotelera al momento de confirmar.")}" />
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">4</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Imágenes</h4>
              <p class="form-section__hint">Opcional. Puedes cargar, quitar y ordenar fotos.</p>
            </div>
          </div>
          <div class="field">
            <label>Fotos del Hospedaje/Destino (Max ${MAX_QUOTATION_IMAGES})</label>
            <input type="file" id="qImagesInput" multiple accept="image/*" />
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:8px;">
              <div class="kbd">Puedes quitar, reordenar y volver a cargar fotos.</div>
              <button type="button" class="btn ghost" id="qImagesClearAll">Quitar todas</button>
            </div>
            <div id="qImagesPreview" style="display:flex; gap:10px; margin-top:10px; overflow-x:auto; flex-wrap:wrap;">
              ${renderImageThumbs()}
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">5</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Contenido del Paquete</h4>
              <p class="form-section__hint">Personaliza textos de transporte, hotel, traslados y condiciones.</p>
            </div>
          </div>
          <div class="field">
            <label>Transporte y Vuelos</label>
            <textarea id="tTransport" rows="3">${toRichEditableHtml(d.tTransport || "Vuelos ida y vuelta desde...\nAerolíneas reconocidas.\nEquipaje de mano incluido.")}</textarea>
          </div>

          <div class="field">
            <label>Alojamiento</label>
            <textarea id="tLodging" rows="3">${toRichEditableHtml(d.tLodging || "Hospedaje en hotel categoría turística superior.\nUbicación estratégica.")}</textarea>
          </div>

          <div class="field">
            <label>Traslados</label>
            <textarea id="tTransfers" rows="2">${toRichEditableHtml(d.tTransfers || "Traslado privado Aeropuerto - Hotel - Aeropuerto.")}</textarea>
          </div>

          <div class="grid">
            <div class="field col-6">
                <label>Incluye</label>
                <textarea id="tInc" rows="4">${toRichEditableHtml(d.tInc || "Boleto aéreo.\nAlojamiento.\nTraslados.\nGestión de reservas.")}</textarea>
            </div>
            <div class="field col-6">
                <label>No Incluye</label>
                <textarea id="tNotInc" rows="4">${toRichEditableHtml(d.tNotInc || "Gastos personales.\nAlimentación no especificada.\nSeguro de viaje.")}</textarea>
            </div>
          </div>

          <div class="field">
            <label>Condiciones</label>
            <textarea id="tCond" rows="2">${toRichEditableHtml(d.tCond || "Depósito no reembolsable.\nCambios sujetos a políticas.")}</textarea>
          </div>

          <div class="field">
            <label>Link de reservación (pago)</label>
            <input id="qReserveLink" value="${escapeHtml(d.reserveLink || "")}" placeholder="https://..." />
            <div class="kbd" style="margin-top:6px;">En el PDF se mostrará como: "Haz clic aquí para reservar".</div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">6</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Itinerario por Días (Opcional)</h4>
              <p class="form-section__hint">Si activas esta opción, el PDF agrega sección día a día con imagen a la izquierda.</p>
            </div>
          </div>
          <div class="field">
            <label style="display:flex; align-items:center; gap:8px;">
              <input id="qEnableItinerary" type="checkbox" ${d.itineraryEnabled ? "checked" : ""} />
              Habilitar itinerario por días en PDF
            </label>
          </div>

          <div id="qItineraryWrap" style="${d.itineraryEnabled ? "" : "display:none;"}">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <div class="kbd">Añade los días que necesites. Cada día acepta 1 imagen.</div>
              <button type="button" class="btn" id="qAddItineraryDay">+ Agregar día</button>
            </div>
            <div id="qItineraryList">
              ${(itineraryDays.length ? itineraryDays : [{}]).map((day, idx) => renderItineraryDayRow(day, idx)).join("")}
            </div>
          </div>
        </div>
      </div>
    `,
    onSave: async () => {
      try {
      const gv = (id) => (document.getElementById(id)?.value ?? "");
      const gvt = (id) => gv(id).trim();

      // Gather data
      const normalizeClientName = (v) => (v || "").trim().replace(/\s+/g, " ").toLowerCase();
      const clientInputRaw = gvt("qClientSearch");
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
      const clientName = clientObj?.name || "";
      const clientDisplay = clientInputRaw;

      const destination = gvt("qDest");
      const docDate = gv("qDocDate");
      const selectedStatusId = gv("qStatus");
      const selectedStatus = quotationStatuses.find(st => st.id === selectedStatusId) || defaultStatus || { id: "quo_draft", label: "Borrador" };
      const startDate = gv("qStart");
      const endDate = gv("qEnd");
      if (!clientInputRaw) { toast("Completa el cliente."); return; }
      if (!destination) { toast("Completa el destino."); return; }
      if (!startDate || !endDate) { toast("Completa llegada y salida."); return; }

      // Calc logic logic reuse
      const currency = gv("qCurrency") || "USD";
      const adults = parseNum(gv("qAdults"));
      const children = parseNum(gv("qChildren"));
      const priceAd = parseNum(gv("qPriceAd"));
      const priceCh = parseNum(gv("qPriceCh"));
      const depPct = parseNum(gv("qDepPct"));

      const total = (adults * priceAd) + (children * priceCh);
      const deposit = total * (depPct / 100);
      const pricePerPerson = (adults + children) > 0 ? (total / (adults + children)) : 0;

      const datesText = gv("qDatesText");
      const duration = gv("qDuration");
      const paxText = gvt("qPaxText");
      const priceNote = gvt("qPriceNote");

      const tTransport = gvt("tTransport");
      const tLodging = gvt("tLodging");
      const tTransfers = gvt("tTransfers");
      const tInc = gvt("tInc");
      const tNotInc = gvt("tNotInc");
      const tCond = gvt("tCond");
      const reserveLink = gvt("qReserveLink");
      const itineraryEnabled = !!document.getElementById("qEnableItinerary")?.checked;
      const itineraryDays = itineraryEnabled
        ? Array.from(document.querySelectorAll("#qItineraryList .q-it-day-item"))
          .map((row, idx) => {
            const getVal = (selector) => ((row.querySelector(selector)?.value || "").trim());
            const day = getVal(".q-it-day-label") || `DÍA ${idx + 1}`;
            const title = getVal(".q-it-day-title");
            const text = getVal(".q-it-day-text");
            const meals = getVal(".q-it-day-meals");
            const image = row.querySelector(".q-it-day-image-value")?.value || "";
            return { day, title, text, meals, image };
          })
          .filter(item => item.title || item.text || item.meals || item.image)
        : [];

      const payload = {
        id: isEditing ? existing.id : uid("quo"),
        clientId, clientName, clientDisplay,
        statusId: selectedStatus.id,
        statusLabel: selectedStatus.label,
        destination, docDate, startDate, endDate,
        datesText, duration, adults, children, paxText,
        currency, priceAd, priceCh, depPct, total, deposit, pricePerPerson,
        priceNote,
        images: currentImages,
        tTransport, tLodging, tTransfers, tInc, tNotInc, tCond,
        reserveLink,
        itineraryEnabled,
        itineraryDays,
        createdAt: isEditing ? (existing.createdAt || new Date().toISOString()) : new Date().toISOString()
      };
      const payloadForServer = JSON.parse(JSON.stringify(payload));

      if (!Array.isArray(state.quotations)) state.quotations = [];

      const applyPayload = (p) => {
        if (isEditing) Object.assign(existing, p);
        else state.quotations.push(p);
      };
      const replacePayloadInState = (p) => {
        if (isEditing) {
          Object.assign(existing, p);
          return;
        }
        state.quotations[state.quotations.length - 1] = p;
      };

      applyPayload(payload);

      try {
        saveState();
      } catch (saveErr) {
        const msg = String(saveErr?.message || saveErr || "").toLowerCase();
        const quotaLike = msg.includes("quota") || msg.includes("storage") || msg.includes("exceeded");
        if (!quotaLike) throw saveErr;

        // Fallback 1: recompress all images and retry keeping visual content.
        const compactPayload = {
          ...payload,
          images: await Promise.all((payload.images || []).map(src => recompressDataUrl(src, { maxWidth: 640, maxHeight: 480, quality: 0.55 }))),
          itineraryDays: await Promise.all((payload.itineraryDays || []).map(async (dy) => ({
            ...dy,
            image: dy.image ? await recompressDataUrl(dy.image, { maxWidth: 560, maxHeight: 420, quality: 0.52 }) : ""
          })))
        };
        replacePayloadInState(compactPayload);
        try {
          saveState();
          toast("Cotización guardada con imágenes optimizadas para ahorrar espacio.");
        } catch (saveErr2) {
          const msg2 = String(saveErr2?.message || saveErr2 || "").toLowerCase();
          const quotaLike2 = msg2.includes("quota") || msg2.includes("storage") || msg2.includes("exceeded");
          if (!quotaLike2) throw saveErr2;

          // Fallback 2: stronger compression.
          const ultraCompactPayload = {
            ...compactPayload,
            images: await Promise.all((compactPayload.images || []).map(src => recompressDataUrl(src, { maxWidth: 520, maxHeight: 390, quality: 0.42 }))),
            itineraryDays: await Promise.all((compactPayload.itineraryDays || []).map(async (dy) => ({
              ...dy,
              image: dy.image ? await recompressDataUrl(dy.image, { maxWidth: 460, maxHeight: 340, quality: 0.40 }) : ""
            })))
          };
          replacePayloadInState(ultraCompactPayload);
          try {
            saveState();
            toast("Cotización guardada con compresión alta de imágenes.");
          } catch (saveErr3) {
            const msg3 = String(saveErr3?.message || saveErr3 || "").toLowerCase();
            const quotaLike3 = msg3.includes("quota") || msg3.includes("storage") || msg3.includes("exceeded");
            if (!quotaLike3) throw saveErr3;

            // Fallback 3: compact all quotations globally to free storage and retry.
            await compactAllQuotationsForStorage({ keepQuotationId: payload.id });
            replacePayloadInState(ultraCompactPayload);
            try {
              saveState();
              toast("Cotización guardada tras optimizar imágenes del sistema.");
            } catch (saveErr4) {
              const msg4 = String(saveErr4?.message || saveErr4 || "").toLowerCase();
              const quotaLike4 = msg4.includes("quota") || msg4.includes("storage") || msg4.includes("exceeded");
              if (!quotaLike4) throw saveErr4;

              // Last fallback: keep record but strip heavy image payloads.
              const slimPayload = {
                ...ultraCompactPayload,
                images: [],
                itineraryDays: (ultraCompactPayload.itineraryDays || []).map(dy => ({ ...dy, image: "" }))
              };
              replacePayloadInState(slimPayload);
              await compactAllQuotationsForStorage({ keepQuotationId: payload.id });
              saveState();
              toast("Cotización guardada sin imágenes (límite de almacenamiento alcanzado).");
            }
          }
        }
      }

      quotationsApiSyncStarted = false;
      quotationsLastFetchKey = "";
      closeModal();
      rerenderQuotationsView();
      toast("Cotización guardada.");

      // Async sync to keep UI responsive.
      Promise.resolve().then(async () => {
        try {
          const remoteItem = await upsertQuotationToApi(payloadForServer);
          if (remoteItem && remoteItem.id) {
            if (isEditing) Object.assign(existing, remoteItem);
            else {
              const idx = state.quotations.findIndex(q => q.id === remoteItem.id);
              if (idx >= 0) state.quotations[idx] = remoteItem;
            }
            saveState();
          }
        } catch {
          toast("Guardado local OK. No se pudo sincronizar con la base de datos.");
        }
      });
      } catch (err) {
        console.error("Error guardando cotización:", err);
        const details = err?.message ? ` (${err.message})` : "";
        toast(`No se pudo guardar la cotización${details}`);
      }
    }
  });

  // Render preview handler
  const renderPreview = () => {
    const p = document.getElementById("qImagesPreview");
    if (!p) return;
    p.innerHTML = renderImageThumbs();
  };

  // Attach Image Listener
  setTimeout(() => {
    const input = document.getElementById("qImagesInput");
    const preview = document.getElementById("qImagesPreview");
    const btnClearAll = document.getElementById("qImagesClearAll");

    if (preview) {
      preview.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".q-img-remove");
        if (btn) {
          const idx = Number(btn.dataset.index);
          if (!Number.isNaN(idx)) {
            currentImages.splice(idx, 1);
            renderPreview();
          }
          return;
        }

        const leftBtn = ev.target.closest(".q-img-move-left");
        if (leftBtn) {
          const idx = Number(leftBtn.dataset.index);
          if (!Number.isNaN(idx) && idx > 0) {
            [currentImages[idx - 1], currentImages[idx]] = [currentImages[idx], currentImages[idx - 1]];
            renderPreview();
          }
          return;
        }

        const rightBtn = ev.target.closest(".q-img-move-right");
        if (rightBtn) {
          const idx = Number(rightBtn.dataset.index);
          if (!Number.isNaN(idx) && idx < currentImages.length - 1) {
            [currentImages[idx], currentImages[idx + 1]] = [currentImages[idx + 1], currentImages[idx]];
            renderPreview();
          }
        }
      });
    }

    if (btnClearAll) {
      btnClearAll.addEventListener("click", () => {
        currentImages = [];
        renderPreview();
      });
    }

    if (input) {
      input.addEventListener("change", async (e) => {
        const remainingSlots = Math.max(0, MAX_QUOTATION_IMAGES - currentImages.length);
        if (!remainingSlots) {
          toast(`Ya alcanzaste el máximo de ${MAX_QUOTATION_IMAGES} fotos.`);
          e.target.value = "";
          return;
        }
        const files = Array.from(e.target.files).slice(0, remainingSlots);
        if (!files.length) return;
        try {
          const promises = files.map(f => uploadImageToBlob(f, { fallbackToBase64: true }));
          const results = await Promise.all(promises);
          currentImages = currentImages.concat(results).slice(0, MAX_QUOTATION_IMAGES);
          renderPreview();
          toast("Imágenes cargadas.");
        } catch (err) {
          toast("Error cargando imágenes.");
        } finally {
          e.target.value = "";
        }
      });
    }

    const qEnableItinerary = document.getElementById("qEnableItinerary");
    const qItineraryWrap = document.getElementById("qItineraryWrap");
    const qItineraryList = document.getElementById("qItineraryList");
    const qAddItineraryDay = document.getElementById("qAddItineraryDay");

    if (qEnableItinerary && qItineraryWrap) {
      qEnableItinerary.addEventListener("change", () => {
        qItineraryWrap.style.display = qEnableItinerary.checked ? "" : "none";
      });
    }

    if (qAddItineraryDay && qItineraryList) {
      qAddItineraryDay.addEventListener("click", () => {
        const idx = qItineraryList.querySelectorAll(".q-it-day-item").length;
        qItineraryList.insertAdjacentHTML("beforeend", renderItineraryDayRow({}, idx));
      });
    }

    if (qItineraryList) {
      qItineraryList.addEventListener("click", (ev) => {
        const removeBtn = ev.target.closest(".q-it-day-remove");
        if (removeBtn) {
          const row = removeBtn.closest(".q-it-day-item");
          if (row) row.remove();
        }
      });

      qItineraryList.addEventListener("change", async (ev) => {
        const fileInput = ev.target.closest(".q-it-day-image-file");
        if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
        const row = fileInput.closest(".q-it-day-item");
        if (!row) return;
        try {
          const imageUrl = await uploadImageToBlob(fileInput.files[0], { fallbackToBase64: true });
          const hidden = row.querySelector(".q-it-day-image-value");
          if (hidden) hidden.value = imageUrl;
          const wrap = row.querySelector(".q-it-day-image-preview-wrap");
          if (wrap) {
            wrap.innerHTML = `<img class="q-it-day-image-preview" src="${imageUrl}" />`;
          }
          toast("Imagen del día cargada.");
        } catch {
          toast("No se pudo cargar la imagen del día.");
        } finally {
          fileInput.value = "";
        }
      });
    }

  }, 100);

  // Attach calc handlers globally exposed if needed, or inline
  window.calcTotals = () => {
    const adults = parseNum(document.getElementById("qAdults").value);
    const children = parseNum(document.getElementById("qChildren").value);
    const priceAd = parseNum(document.getElementById("qPriceAd").value);
    const priceCh = parseNum(document.getElementById("qPriceCh").value);
    const depPct = parseNum(document.getElementById("qDepPct").value);
    const cur = document.getElementById("qCurrency").value;

    const total = (adults * priceAd) + (children * priceCh);
    const deposit = total * (depPct / 100);
    const ppp = (adults + children) > 0 ? (total / (adults + children)) : 0;

    document.getElementById("qTotal").value = toMoney(total, cur);
    document.getElementById("qDeposit").value = toMoney(deposit, cur);
    document.getElementById("qPerPerson").value = toMoney(ppp, cur);
  };

  window.calcDates = () => {
    const s = document.getElementById("qStart").value;
    const e = document.getElementById("qEnd").value;
    if (!s || !e) return;
    const parseISODate = (iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      if (!y || !m || !d) return null;
      return { y, m, d };
    };
    const start = parseISODate(s);
    const end = parseISODate(e);
    if (!start || !end) return;

    // Use UTC day math to avoid timezone shifts (Safari/local offset issues).
    const startUTC = Date.UTC(start.y, start.m - 1, start.d);
    const endUTC = Date.UTC(end.y, end.m - 1, end.d);
    const diff = endUTC - startUTC;
    const days = Math.round(diff / 86400000);
    if (days >= 0) {
      document.getElementById("qDuration").value = `${days} noches`;
      // chips format
      const mo = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      document.getElementById("qDatesText").value = `${start.d} ${mo[start.m - 1]} - ${end.d} ${mo[end.m - 1]} ${end.y}`;
    }
  };
}

export function editQuotation(id) {
  const q = state.quotations.find(x => x.id === id);
  if (q) openQuotationModal(q);
}

export function duplicateQuotation(id) {
  if (!(hasPermission("quotations.manage") || hasPermission("*"))) {
    toast("No tienes permiso para duplicar cotizaciones.");
    return;
  }
  const source = state.quotations.find(x => x.id === id);
  if (!source) return;

  closeQuotationMenus();
  const draft = typeof structuredClone === "function"
    ? structuredClone(source)
    : JSON.parse(JSON.stringify(source));

  delete draft.id;
  delete draft.createdAt;
  draft.__draftDuplicate = true;
  setTimeout(() => openQuotationModal(draft), 0);
  toast("Formulario duplicado listo. Se guarda cuando presiones Guardar.");
}

export function deleteQuotation(id) {
  if (!(hasPermission("quotations.manage") || hasPermission("*"))) {
    toast("No tienes permiso para eliminar cotizaciones.");
    return;
  }
  if (!confirm("¿Eliminar cotización?")) return;
  state.quotations = state.quotations.filter(x => x.id !== id);
  saveState();
  quotationsApiSyncStarted = false;
  quotationsLastFetchKey = "";
  rerenderQuotationsView();
  toast("Cotización eliminada.");
  Promise.resolve().then(async () => {
    try {
      await deleteQuotationFromApi(id);
    } catch {
      toast("Se eliminó localmente, pero falló eliminar en la base de datos.");
    }
  });
}

export function convertQuotationToItinerary(id) {
  if (!(hasPermission("quotations.manage") || hasPermission("*"))) {
    toast("No tienes permiso para convertir cotizaciones.");
    return;
  }
  const q = state.quotations.find(x => x.id === id);
  if (!q) return;

  closeQuotationMenus();

  const plainLines = (value = "") => String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const itineraryDays = (q.itineraryEnabled && Array.isArray(q.itineraryDays))
    ? q.itineraryDays.map((d, idx) => ({
      day: d.day || `DÍA ${idx + 1}`,
      title: d.title || "",
      content: d.text || d.content || "",
      text: d.text || d.content || "",
      meals: d.meals || "",
      image: d.image || "",
    }))
    : [];

  const itineraryPayload = {
    id: uid("iti"),
    clientId: q.clientId || "",
    clientName: q.clientName || "",
    clientDisplay: q.clientDisplay || "",
    statusId: q.statusId || "",
    statusLabel: q.statusLabel || "",
    destination: q.destination || "",
    title: q.destination || "Itinerario de Viaje",
    tripId: "",
    tripName: "",
    tripDisplay: q.destination || "",
    docDate: q.docDate || "",
    startDate: q.startDate || "",
    endDate: q.endDate || "",
    datesText: q.datesText || "",
    duration: q.duration || "",
    adults: Number.isFinite(Number(q.adults)) ? Number(q.adults) : 2,
    children: Number.isFinite(Number(q.children)) ? Number(q.children) : 0,
    paxText: q.paxText || "",
    currency: q.currency || "USD",
    total: Number(q.total || 0),
    tTransport: q.tTransport || "",
    tLodging: q.tLodging || "",
    tTransfers: q.tTransfers || "",
    ctaLink: q.reserveLink || "",
    includes: plainLines(q.tInc || ""),
    excludes: plainLines(q.tNotInc || ""),
    terms: plainLines(q.tCond || ""),
    galleryImages: Array.isArray(q.images) ? q.images.slice(0, 6) : [],
    coverImage: Array.isArray(q.images) && q.images.length ? q.images[0] : "",
    flightInfo: { airlineOut: "", airlineBack: "", departureCities: [] },
    itineraryEnabled: itineraryDays.length > 0,
    days: itineraryDays,
    updatedAt: new Date().toLocaleString(state.settings.locale),
  };

  const created = pushTenantItem("itineraries", itineraryPayload);
  saveState();

  Promise.resolve().then(async () => {
    try {
      await upsertItineraryToApi(itineraryPayload);
    } catch {
      toast("Itinerario creado localmente. Falló sincronización con base de datos.");
    }
  });

  if (typeof window.navigate === "function") {
    window.navigate("itineraries");
  } else if (window.render) {
    window.render();
  }

  setTimeout(() => {
    if (typeof window.openItineraryModal === "function") {
      window.openItineraryModal(created || itineraryPayload);
    }
  }, 0);
  toast("Cotización convertida a itinerario.");
}


// ========================
// PDF GENERATION (The magic part)
// ========================
export async function exportQuotationPDF(id) {
  return generateQuotationPDF(id, "download");
}

export async function previewQuotationPDF(id) {
  return generateQuotationPDF(id, "preview");
}

async function generateQuotationPDF(id, mode = "download") {
  if (quotationPdfBusy) return;
  quotationPdfBusy = true;
  const q = state.quotations.find(x => x.id === id);
  if (!q) {
    quotationPdfBusy = false;
    return;
  }

  // Defensive close in case export is triggered from any other entry point.
  closeQuotationMenus();

  const root = document.getElementById("pdf-root");
  const s = state.settings;
  const companyRaw = (s.companyName || "Brianessa Travel | Tu agencia de viajes de confianza").trim();
  const [companyTitlePart, companyTaglinePart] = companyRaw.split("|").map(x => (x || "").trim());
  const companyTitle = companyTitlePart || "Brianessa Travel";
  const companyTagline = companyTaglinePart || "Tu agencia de viajes de confianza";
  const companyLine = `${companyTitle} | ${companyTagline}`.trim();

  // Estilos exactos de stylec.css minificados para asegurar fidelidad visual
  const PDF_STYLES = `
    .quotation-pdf-wrap { --ink: #111827; --muted: #6b7280; --line: #e5e7eb; --card: #ffffff; --page: #ffffff; --bg: #f3f4f6; --brand-color: #111827; }
    .quotation-pdf-wrap, .quotation-pdf-wrap * { box-sizing: border-box; }
    .quotation-pdf-wrap { width: 210mm; margin: 0 auto; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
    .qpdf-page {
      width: 210mm;
      height: 297mm;
      background: #fff;
      position: relative;
      overflow: hidden;
      margin: 0 auto;
      border: 1px solid #e5e7eb;
      break-after: page;
      page-break-after: always;
    }
    .qpdf-page:last-child { break-after: auto; page-break-after: auto; }
    .qpdf-page--first .qpdf-page__content { padding-top: 2mm; }
    .qpdf-page__inner {
      height: 100%;
      padding: 4mm 12mm 9mm 12mm;
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 4px;
    }
    .qpdf-page__content {
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .qpdf-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
    .qpdf-brand { display: flex; gap: 12px; align-items: center; }
    .qpdf-brand__logo { width: 60px; height: 60px; border-radius: 10px; object-fit: contain; }
    .qpdf-brand__text { display: flex; flex-direction: column; }
    .qpdf-brand__title { font-weight: 900; font-size: 15px; color: #111; line-height: 1.1; }
    .qpdf-brand__sub { color: #6b7280; font-size: 11px; margin-top: 2px; }
    .qpdf-header__date { font-size: 12px; font-weight: 600; color: #4b5563; }
    .qpdf-hero { display: grid; grid-template-columns: 1.4fr 0.8fr; gap: 20px; margin-top: 24px; align-items: start; }
    .qpdf-pill { display: inline-flex; align-items: center; padding: 4px 10px; border: 1px solid #e5e7eb; border-radius: 99px; font-weight: 700; font-size: 10px; text-transform: uppercase; background: #f9fafb; color: #374151; margin-bottom: 8px; }
    .qpdf-title { margin: 0 0 12px; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; line-height: 1.1; }
    .qpdf-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .qpdf-chip { flex: 1; min-width: 100px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px 10px; background: #fff; }
    .qpdf-chip__label { color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
    .qpdf-chip__value { font-size: 13px; font-weight: 700; color: #111; }
    .qpdf-smallnote { font-size: 11px; color: #6b7280; font-style: italic; }
    .qpdf-pricebox { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .qpdf-pricebox__top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .qpdf-pricebox__label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
    .qpdf-pricebox__price { font-size: 28px; font-weight: 900; color: #111; line-height: 1; margin-top: 4px; }
    .qpdf-pricebox__row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
    .qpdf-pricebox__row strong { font-weight: 800; }
    .qpdf-pricebox__note { margin-top: 10px; font-size: 10px; color: #6b7280; line-height: 1.3; }
    .qpdf-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px; }
    .qpdf-card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; background: #fff; }
    .qpdf-card__head { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #f3f4f6; }
    .qpdf-icon { font-size: 18px; }
    .qpdf-card h3 { margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #111; }
    .qpdf-list { list-style: none; padding: 0; margin: 0; font-size: 12px; line-height: 1.5; color: #374151; }
    .qpdf-list li { margin-bottom: 4px; position: relative; padding-left: 0; }
    .qpdf-footer { margin-top: 0; padding-top: 10px; border-top: 2px solid #f3f4f6; font-size: 10px; color: #4b5563; text-align: center; }
    .qpdf-footer strong { color: #111; }
    .qpdf-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; margin-top: 20px; }
    .qpdf-gallery__img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 12px; border: 1px solid #e5e7eb; background: #f9fafb; }

    /* Visual tuning to match Cotizaciones reference */
    .qpdf-header { gap: 12px; padding-bottom: 0; border-bottom: none; }
    .qpdf-rule { border-top: 1px solid #000; margin: 0; }
    .qpdf-brand__logo { width: 72px; height: 72px; border: 1px solid #e5e7eb; background: #fff; object-fit: contain; border-radius: 10px; }
    .qpdf-brand__title { font-size: 14px; font-weight: 800; line-height: 1.1; white-space: nowrap; }
    .qpdf-brand__sub { display: none; }
    .qpdf-header__date { font-size: 12px; font-weight: 700; color: #111827; }
    .qpdf-hero { display: grid; grid-template-columns: 1.2fr .8fr; gap: 12px; margin-top: 2px; }
    .qpdf-pill { font-size: 12px; padding: 8px 14px; border: 1px solid #000; color: #111827; background: #fff; }
    .qpdf-title { margin: 5px 0 8px; font-size: 42px; letter-spacing: -.4px; font-weight: 900; line-height: 1; }
    .qpdf-chip { min-width: 120px; border: 1px solid #000; }
    .qpdf-chip__label { font-size: 11px; letter-spacing: .3px; }
    .qpdf-chip__value { font-size: 14px; font-weight: 900; margin-top: 4px; }
    .qpdf-smallnote { font-size: 12px; color: #111827; font-style: normal; margin-top: 4px; }
    .qpdf-pricebox { border: 1px solid #000; border-radius: 18px; box-shadow: none; padding: 14px; }
    .qpdf-pricebox__label { font-size: 12px; font-weight: 800; }
    .qpdf-pricebox__price { font-size: 26px; margin-top: 6px; }
    .qpdf-pricebox__row { margin-top: 10px; padding-top: 0; border-top: none; font-size: 13px; }
    .qpdf-pricebox__note { margin-top: 12px; font-size: 12px; color: #111827; line-height: 1.35; }
    .qpdf-cards { margin-top: 6px; gap: 10px; align-items: stretch; }
    .qpdf-card { border: 1px solid #000; border-radius: 18px; padding: 12px 12px 10px; height: 100%; }
    .qpdf-card__head { gap: 10px; margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .qpdf-icon { width: 44px; height: 44px; border: 1px solid #000; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 18px; background: #fff; }
    .qpdf-card h3 { margin: 0; font-size: 18px; line-height: 1.1; letter-spacing: -.2px; text-transform: uppercase; font-weight: 900; }
    .qpdf-list { margin: 10px 0 0; padding: 0 0 0 16px; list-style: disc; font-size: 12.5px; font-weight: 700; line-height: 1.28; }
    .qpdf-list li { margin: 8px 0; color: #111827; }
    .qpdf-footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #000; font-size: 10.5px; color: #111827; text-align: center; line-height: 1.24; }
    .qpdf-footer__brand { margin-bottom: 2px; font-size: 12px; color: #000; font-weight: 700; }
    .qpdf-footer__row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 1px; }
    .qpdf-footer strong { color: var(--brand-color); }
    .qpdf-itinerary-title { margin: 8px 0 2px; font-size: 26px; font-weight: 900; color: #111827; letter-spacing: -.25px; }
    .qpdf-itinerary-sub { margin: 0 0 6px; font-size: 12px; color: #4b5563; }
    .qpdf-itinerary-list { display: grid; gap: 7px; }
    .qpdf-day-block { break-inside: avoid; page-break-inside: avoid; border: 1px solid #000; border-radius: 14px; padding: 8px; background: #fff; }
    .qpdf-day-head { font-size: 16px; color: #111827; font-weight: 900; line-height: 1.08; margin-bottom: 6px; text-transform: uppercase; letter-spacing: -.12px; }
    .qpdf-day-row { display: grid; grid-template-columns: 66mm 1fr; gap: 8px; align-items: center; }
    .qpdf-day-image { width: 66mm; height: 42mm; object-fit: cover; border-radius: 9px; border: 1px solid #000; background: #f9fafb; margin: 0 auto; display: block; }
    .qpdf-day-copy { display: flex; flex-direction: column; justify-content: center; text-align: left; min-height: 42mm; }
    .qpdf-day-text { font-size: 13px; font-weight: 500; line-height: 1.34; color: #111827; white-space: normal; text-align: left; }
    .qpdf-day-meals { margin-top: 7px; font-size: 13px; color: #111827; text-align: left; }
    .qpdf-day-meals__label { font-weight: 900; }
    .qpdf-day-meals__value { font-weight: 500; }
    .qpdf-reserve-box { margin-top: 10px; border: 1px solid #000; border-radius: 14px; padding: 12px; text-align: center; background: #fff; }
    .qpdf-reserve-label { font-size: 12px; color: #4b5563; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
    .qpdf-reserve-link { font-size: 18px; font-weight: 900; color: #1f4a78; text-decoration: underline; }
  `;

  // Helper templates
  const renderHeader = () => `
    <div class="qpdf-header">
       <div class="qpdf-brand">
         ${s.logoDataUrl ? `<img class="qpdf-brand__logo" src="${s.logoDataUrl}" />` : `<div class="qpdf-brand__logo" style="background:#222; color:#fff; display:grid; place-items:center; font-weight:900;">BT</div>`}
         <div class="qpdf-brand__text">
           <div class="qpdf-brand__title">${escapeHtml(companyLine)}</div>
           <div class="qpdf-brand__sub"></div>
         </div>
       </div>
       <div class="qpdf-header__date">Fecha: ${escapeHtml(q.docDate || "")}</div>
    </div>
  `;

  const renderFooter = () => `
    <div class="qpdf-footer">
       <div class="qpdf-footer__brand"><strong>${escapeHtml(companyTitle)}</strong> | ${escapeHtml(companyTagline)}</div>
       <div class="qpdf-footer__row">
         <span>Teléfono: <strong>${escapeHtml(s.phone || "")}</strong></span>
         <span>Correo electrónico: <strong>${escapeHtml(s.email || "")}</strong></span>
       </div>
       <div class="qpdf-footer__row">
         <span>Redes sociales: <strong>Instagram: ${escapeHtml(s.instagram || "")} Facebook: ${escapeHtml(s.facebook || "")}</strong></span>
       </div>
       <div>Sitio web: <strong>${escapeHtml(s.website || "")}</strong></div>
    </div>
  `;

  const renderGallery = () => {
    if (!q.images || !q.images.length) return "";
    const imgs = q.images.slice(0, 6).map(src => `<img class="qpdf-gallery__img" src="${src}" />`).join("");
    return `<div class="qpdf-gallery">${imgs}</div>`;
  };

  const sanitizeRichHtml = (raw = "") => {
    const tpl = document.createElement("template");
    tpl.innerHTML = String(raw || "");
    const allowedTags = new Set(["B", "STRONG", "SPAN", "BR", "I", "EM", "#text"]);

    const cleanStyle = (style = "") => {
      const out = [];
      String(style || "").split(";").forEach(pair => {
        const [k, v] = pair.split(":").map(x => (x || "").trim());
        if (!k || !v) return;
        if (k === "color") {
          const ok = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) || /^[a-zA-Z]+$/.test(v) || /^rgb(a?)\(/.test(v);
          if (ok) out.push(`color:${v}`);
        }
        if (k === "font-size") {
          const m = v.match(/^(\d{1,2})px$/);
          if (m) {
            const n = Math.max(10, Math.min(30, Number(m[1])));
            out.push(`font-size:${n}px`);
          }
        }
      });
      return out.join("; ");
    };

    const walk = (node) => {
      const children = Array.from(node.childNodes);
      children.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) return;
        const tag = child.nodeName.toUpperCase();
        if (!allowedTags.has(tag)) {
          const text = document.createTextNode(child.textContent || "");
          child.replaceWith(text);
          return;
        }
        if (tag === "SPAN") {
          const clean = cleanStyle(child.getAttribute("style") || "");
          if (clean) child.setAttribute("style", clean);
          else child.removeAttribute("style");
        } else {
          Array.from(child.attributes || []).forEach(attr => child.removeAttribute(attr.name));
        }
        walk(child);
      });
    };
    walk(tpl.content);
    return tpl.innerHTML;
  };

  const richToHtml = (txt = "") => {
    const raw = String(txt || "");
    if (/<[a-z][\s\S]*>/i.test(raw)) {
      return sanitizeRichHtml(raw).replace(/\n/g, "<br/>");
    }
    const safe = escapeHtml(raw);
    const withBold = safe.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>");
    const withColor = withBold.replace(/\[color=([#a-zA-Z0-9(),.%\s-]+)\]([\s\S]*?)\[\/color\]/gi, (_, color, content) => {
      const c = String(color || "").trim();
      const allowed = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) || /^[a-zA-Z]+$/.test(c);
      return allowed ? `<span style="color:${c};">${content}</span>` : content;
    });
    const withSize = withColor.replace(/\[size=(\d{1,2})\]([\s\S]*?)\[\/size\]/gi, (_, size, content) => {
      const n = Math.max(10, Math.min(30, Number(size || 13)));
      return `<span style="font-size:${n}px;">${content}</span>`;
    });
    return withSize.replace(/\n/g, "<br/>");
  };

  const splitRichLines = (txt = "") => {
    const raw = String(txt || "");
    if (!raw.trim()) return [];
    if (!/<[a-z][\s\S]*>/i.test(raw)) {
      return raw.split("\n").map(x => x.trim()).filter(Boolean);
    }
    const normalized = sanitizeRichHtml(raw)
      .replace(/<\/(div|p|li|h[1-6])>/gi, "\n")
      .replace(/<(div|p|li|h[1-6])[^>]*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n");
    return normalized.split("\n").map(x => x.trim()).filter(Boolean);
  };

  const lines = (txt) => splitRichLines(txt).map(x => `<li>${richToHtml(x)}</li>`).join("");
  const itineraryDays = (q.itineraryEnabled && Array.isArray(q.itineraryDays)) ? q.itineraryDays : [];
  const renderItineraryDayBlock = (d, idx) => `
    <div class="qpdf-day-block">
      <div class="qpdf-day-head">${escapeHtml(d.day || `DÍA ${idx + 1}`)}${d.title ? `: ${escapeHtml(d.title)}` : ""}</div>
      <div class="qpdf-day-row">
        ${d.image ? `<img class="qpdf-day-image" src="${d.image}" />` : `<div class="qpdf-day-image"></div>`}
        <div class="qpdf-day-copy">
          <div class="qpdf-day-text">${richToHtml(d.text || d.content || "")}</div>
          ${d.meals ? `<div class="qpdf-day-meals"><span class="qpdf-day-meals__label">Comidas Incluidas:</span> <span class="qpdf-day-meals__value">${richToHtml(d.meals)}</span></div>` : ""}
        </div>
      </div>
    </div>
  `;

  const buildDynamicItineraryChunks = (days = []) => {
    if (!days.length) return [];

    const styleEl = document.createElement("style");
    styleEl.textContent = PDF_STYLES;
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-99999px";
    host.style.top = "0";
    host.style.width = "210mm";
    host.style.visibility = "hidden";
    host.style.pointerEvents = "none";

    const makeMeasurePage = () => {
      host.innerHTML = `
        <div class="quotation-pdf-wrap">
          <div class="qpdf-page">
            <div class="qpdf-page__inner">
              ${renderHeader()}
              <div class="qpdf-rule"></div>
              <div class="qpdf-page__content">
                <h2 class="qpdf-itinerary-title">Itinerario</h2>
                <p class="qpdf-itinerary-sub">Plan diario de actividades con formato visual de la cotización.</p>
                <div class="qpdf-itinerary-list" id="qpdf-itinerary-measure-list"></div>
              </div>
              ${renderFooter()}
            </div>
          </div>
        </div>
      `;
      const content = host.querySelector(".qpdf-page__content");
      const list = host.querySelector("#qpdf-itinerary-measure-list");
      return { content, list };
    };

    document.body.appendChild(styleEl);
    document.body.appendChild(host);

    const chunks = [];
    let currentChunk = [];
    let page = makeMeasurePage();

    const appendDayAndCheckOverflow = (day, idx) => {
      const probe = document.createElement("div");
      probe.innerHTML = renderItineraryDayBlock(day, idx);
      const block = probe.firstElementChild;
      page.list.appendChild(block);
      return page.content.scrollHeight > (page.content.clientHeight + 1);
    };

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const overflow = appendDayAndCheckOverflow(day, i);

      if (!overflow) {
        currentChunk.push(day);
        continue;
      }

      // If it overflowed, remove and move this day to next page.
      page.list.removeChild(page.list.lastElementChild);

      if (currentChunk.length) {
        chunks.push(currentChunk);
      }

      currentChunk = [];
      page = makeMeasurePage();

      // Add day on fresh page; if still overflows, force it to avoid lock.
      const stillOverflow = appendDayAndCheckOverflow(day, i);
      currentChunk.push(day);
      if (stillOverflow) {
        chunks.push(currentChunk);
        currentChunk = [];
        page = makeMeasurePage();
      }
    }

    if (currentChunk.length) chunks.push(currentChunk);

    host.remove();
    styleEl.remove();
    return chunks;
  };
  const itineraryChunks = buildDynamicItineraryChunks(itineraryDays);

  const renderReserveBox = () => q.reserveLink ? `
    <div class="qpdf-reserve-box qpdf-reserve-box--inline">
      <div class="qpdf-reserve-label">Reservación</div>
      <a class="qpdf-reserve-link qpdf-reserve-link-anchor" href="${escapeHtml(q.reserveLink)}" target="_blank" rel="noopener">Haz clic aquí para reservar</a>
    </div>
  ` : "";

  const renderItineraryPage = (daysChunk = [], isLastChunk = false) => `
    <div class="qpdf-page">
      <div class="qpdf-page__inner">
        ${renderHeader()}
        <div class="qpdf-rule"></div>
        <div class="qpdf-page__content">
          <h2 class="qpdf-itinerary-title">Itinerario</h2>
          <p class="qpdf-itinerary-sub">Plan diario de actividades con formato visual de la cotización.</p>
          <div class="qpdf-itinerary-list">
            ${daysChunk.map((d, idx) => renderItineraryDayBlock(d, idx)).join("")}
          </div>
          ${isLastChunk ? renderReserveBox() : ""}
        </div>
        ${renderFooter()}
      </div>
    </div>
  `;

  // CONTENT PAGE 1
  const page1 = `
    <div class="qpdf-page qpdf-page--first">
      <div class="qpdf-page__inner">
        ${renderHeader()}
        <div class="qpdf-rule"></div>
        <div class="qpdf-page__content">
          <!-- HERO -->
          <div class="qpdf-hero">
             <div class="qpdf-hero__left">
                <div class="qpdf-pill">Cotización de Viaje</div>
                <h1 class="qpdf-title">${escapeHtml(q.destination)}</h1>
                
                <div class="qpdf-chips">
                  <div class="qpdf-chip">
                    <div class="qpdf-chip__label">Fechas</div>
                    <div class="qpdf-chip__value">${escapeHtml(q.datesText || "Por definir")}</div>
                  </div>
                  <div class="qpdf-chip">
                    <div class="qpdf-chip__label">Duración</div>
                    <div class="qpdf-chip__value">${escapeHtml(q.duration || "")}</div>
                  </div>
                  <div class="qpdf-chip">
                    <div class="qpdf-chip__label">Pasajeros</div>
                    <div class="qpdf-chip__value">${escapeHtml(q.paxText || `${q.adults} adultos`)}</div>
                  </div>
                </div>
                <div class="qpdf-smallnote">*Detalles de hotel y vuelos se entregan al confirmar la reserva.</div>
             </div>

             <div class="qpdf-hero__right">
                <div class="qpdf-pricebox">
                   <div class="qpdf-pricebox__top">
                      <div>
                        <div class="qpdf-pricebox__label">Inversión desde por persona</div>
                        <div class="qpdf-pricebox__price">Desde ${toMoney(q.pricePerPerson, q.currency)}</div>
                      </div>
                      <div class="qpdf-pill">${escapeHtml(q.currency)}</div>
                   </div>
                   <div class="qpdf-pricebox__row">
                      <span>Total Grupo</span> <strong>${toMoney(q.total, q.currency)}</strong>
                   </div>
                   ${q.deposit > 0 ? `<div class="qpdf-pricebox__row"><span>Reserva con</span> <strong>${toMoney(q.deposit, q.currency)}</strong></div>` : ''}
                   <div class="qpdf-pricebox__note">${escapeHtml(q.priceNote || "")}</div>
                </div>
             </div>
          </div>

          <div class="qpdf-cards">
             <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">✈️</span><h3>Transporte</h3></div>
                <ul class="qpdf-list">${lines(q.tTransport)}</ul>
             </div>
             <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">🏨</span><h3>Alojamiento</h3></div>
                <ul class="qpdf-list">${lines(q.tLodging)}</ul>
             </div>
             <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">🚐</span><h3>Traslados</h3></div>
                <ul class="qpdf-list">${lines(q.tTransfers)}</ul>
             </div>
          </div>
        </div>

        ${renderFooter()}
      </div>
    </div>
  `;

  // CONTENT PAGE 2
  const page2 = `
    <div class="qpdf-page">
      <div class="qpdf-page__inner">
        ${renderHeader()}
        <div class="qpdf-rule"></div>
        <div class="qpdf-page__content">
          ${renderGallery()}

          <h3 style="margin-top:20px; text-transform:uppercase; color:#6b7280; font-size:14px;">Detalles del Paquete</h3>
          
          <div class="qpdf-cards">
             <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">✅</span><h3>Incluye</h3></div>
                <ul class="qpdf-list">${lines(q.tInc)}</ul>
             </div>
             <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">❌</span><h3>No Incluye</h3></div>
                <ul class="qpdf-list">${lines(q.tNotInc)}</ul>
             </div>
             <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">📄</span><h3>Condiciones</h3></div>
                <ul class="qpdf-list">${lines(q.tCond)}</ul>
             </div>
          </div>
          ${!itineraryChunks.length ? renderReserveBox() : ""}
        </div>

        ${renderFooter()}
      </div>
    </div>
  `;
  const itineraryPages = itineraryChunks.map((chunk, idx) => renderItineraryPage(chunk, idx === itineraryChunks.length - 1)).join("");
  root.innerHTML = `<style>${PDF_STYLES}</style><div class="quotation-pdf-wrap">${page1}${page2}${itineraryPages}</div>`;

  // 2. Generate PDF (manual per-page render to avoid blank pages between page 1 and 2)
  const toFileLabel = (value, fallback) => {
    const raw = (value || fallback).toString().trim();
    return raw
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };
  const clientLabel = toFileLabel(q.clientName || q.clientDisplay, "Cliente");
  const destinationLabel = toFileLabel(q.destination, "Destino");
  const filename = `Cotizacion - ${clientLabel} - ${destinationLabel}.pdf`;

  try {
    if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
      throw new Error("Faltan librerías PDF (jsPDF/html2canvas).");
    }

    const pages = Array.from(root.querySelectorAll(".qpdf-page"));
    if (!pages.length) throw new Error("No encontré páginas para exportar.");

    // Capture reserve-link anchors before rasterization so we can add real clickable links in PDF.
    const reserveLinks = [];
    if (q.reserveLink) {
      pages.forEach((pageEl, pageIdx) => {
        const anchor = pageEl.querySelector(".qpdf-reserve-link-anchor");
        if (!anchor) return;
        const pageRect = pageEl.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        if (!pageRect.width || !pageRect.height) return;
        const x = ((anchorRect.left - pageRect.left) / pageRect.width) * 210;
        const y = ((anchorRect.top - pageRect.top) / pageRect.height) * 297;
        const w = (anchorRect.width / pageRect.width) * 210;
        const h = (anchorRect.height / pageRect.height) * 297;
        reserveLinks.push({ page: pageIdx + 1, x, y, w, h, url: q.reserveLink });
      });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const forceDownloadPDF = () => {
      doc.save(filename);
    };

    for (let i = 0; i < pages.length; i++) {
      const canvas = await window.html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.96);
      if (i > 0) doc.addPage("a4", "portrait");
      doc.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    // Add PDF link annotations over the rendered "Haz clic aquí para reservar" text.
    reserveLinks.forEach((ln) => {
      doc.setPage(ln.page);
      doc.link(ln.x, ln.y, ln.w, ln.h, { url: ln.url });
    });

    if (mode === "preview") {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);

      openModal({
        title: "Vista previa de cotización",
        bodyHtml: `
          <div class="card" style="padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
              <div class="kbd">Revisa el documento antes de descargarlo.</div>
              <button class="btn primary" id="btnPreviewDownload">Descargar PDF</button>
            </div>
            <iframe
              src="${url}"
              style="width:100%; height:70vh; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:#fff;"
              title="Vista previa PDF de cotización"
            ></iframe>
          </div>
        `,
        onSave: () => {
          URL.revokeObjectURL(url);
          closeModal();
        }
      });

      const btnPreviewDownload = document.getElementById("btnPreviewDownload");
      if (btnPreviewDownload) {
        btnPreviewDownload.onclick = () => {
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        };
      }
      toast("Vista previa lista ✅");
    } else {
      forceDownloadPDF();
      toast("PDF Cotización descargado ✅");
    }

    root.innerHTML = "";
  } catch (err) {
    console.error(err);
    root.innerHTML = "";
    alert("Error al generar PDF.");
  } finally {
    quotationPdfBusy = false;
  }
}
