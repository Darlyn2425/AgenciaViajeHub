import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal, icon, toast } from "../utils/ui.js";
import { escapeHtml, matchesSearch, uid, parseNum, toMoney, formatDateLongISO } from "../utils/helpers.js";

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

// Helper for image resizing (max 800x600 to save space)
function resizeImage(file) {
  const MAX_WIDTH = 800;
  const MAX_HEIGHT = 600;
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
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Render logic
export function renderQuotations(searchTerm = "") {
  const rows = state.quotations.filter(q => matchesSearch(q, searchTerm)).map(q => {
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
      <button class="menu-item" onclick="window.duplicateQuotation('${q.id}')">
        <span class="mi-ic">${icon('copy')}</span>
        <span class="mi-tx">Duplicar</span>
      </button>
      <div class="menu-sep"></div>
      <button class="menu-item danger" onclick="window.deleteQuotation('${q.id}')">
        <span class="mi-ic">${icon('trash')}</span>
        <span class="mi-tx">Eliminar</span>
      </button>
    `;

    return `
      <tr>
        <td>
          <div class="plan-cell">
            <div class="plan-main">
              <strong>${escapeHtml(q.destination || "Cotización")}</strong>
            </div>
            <div class="kbd">${escapeHtml(q.clientName || q.clientDisplay || "Cliente")}</div>
          </div>
        </td>
        <td>${escapeHtml(q.datesText || "")}</td>
        <td>${toMoney(q.total || 0, q.currency)}</td>
        <td>
          <div class="actions compact">
            <button class="icon-btn" onclick="window.viewQuotation('${q.id}')" title="Ver">${icon('eye')}</button>
            <button class="icon-btn" onclick="window.editQuotation('${q.id}')" title="Editar">${icon('edit')}</button>
            
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
    `<button class="btn primary" onclick="window.openQuotationModal()">+ Nueva cotización</button>`
  )}
      <hr/>
      <table class="table">
        <thead><tr><th>Destino</th><th>Fechas</th><th>Total</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay cotizaciones todavía.</td></tr>`}</tbody>
      </table>
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
  // Leave a short delay so Safari always repaints after closing the dropdown.
  setTimeout(() => {
    if (action === "preview") previewQuotationPDF(id);
    else exportQuotationPDF(id);
  }, 90);
}

// Close menus on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".action-menu")) {
    closeQuotationMenus();
  }
});


// Modal Logic
export function openQuotationModal(existing = null) {
  const MAX_QUOTATION_IMAGES = 6;
  const isEditing = !!existing && !existing.__draftDuplicate;
  const clientOptions = state.clients
    .map(c => `<option value="${escapeHtml(c.name)}"></option>`)
    .join("");

  // Default data structure
  const d = existing || {
    currency: "USD",
    adults: 2,
    children: 0,
    pricePerPerson: 0,
    totalGroup: 0,
    images: []
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

  openModal({
    title: isEditing ? "Editar cotización" : "Nueva cotización",
    bodyHtml: `
      <!-- SELECCIÓN DE CLIENTE -->
      <div class="grid">
        <div class="field col-12">
          <label>Cliente (buscar o crear)</label>
          <input
            id="qClientSearch"
            list="qClientList"
            value="${escapeHtml(d.clientName || d.clientDisplay || "")}"
            placeholder="Escribe para buscar. Si no existe, se creará al guardar."
          />
          <datalist id="qClientList">${clientOptions}</datalist>
          <div class="kbd" style="margin-top:6px;">Si el nombre no existe en clientes, se agrega automáticamente.</div>
        </div>
      </div>

      <hr/>

      <!-- DATOS DEL VIAJE -->
      <div class="grid">
        <div class="field col-6">
          <label>Destino</label>
          <input id="qDest" value="${escapeHtml(d.destination || "")}" placeholder="Ej: Punta Cana" />
        </div>
        <div class="field col-6">
            <label>Fecha Documento</label>
            <input id="qDocDate" type="date" value="${escapeHtml(d.docDate || new Date().toISOString().slice(0, 10))}" />
        </div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Llegada</label><input id="qStart" type="date" value="${escapeHtml(d.startDate || "")}" onchange="calcDates()" /></div>
        <div class="field col-6"><label>Salida</label><input id="qEnd" type="date" value="${escapeHtml(d.endDate || "")}" onchange="calcDates()" /></div>
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

      <hr/>

      <!-- PRECIOS -->
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

      <hr/>

      <!-- IMÁGENES (V2 Feature) -->
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

      <hr/>

      <!-- CONTENIDO -->
      <div class="field">
        <label>Transporte y Vuelos</label>
        <textarea id="tTransport" rows="3">${escapeHtml(d.tTransport || "Vuelos ida y vuelta desde...\nAerolíneas reconocidas.\nEquipaje de mano incluido.")}</textarea>
      </div>

      <div class="field">
        <label>Alojamiento</label>
        <textarea id="tLodging" rows="3">${escapeHtml(d.tLodging || "Hospedaje en hotel categoría turística superior.\nUbicación estratégica.")}</textarea>
      </div>

      <div class="field">
        <label>Traslados</label>
        <textarea id="tTransfers" rows="2">${escapeHtml(d.tTransfers || "Traslado privado Aeropuerto - Hotel - Aeropuerto.")}</textarea>
      </div>

      <div class="grid">
        <div class="field col-6">
            <label>Incluye</label>
            <textarea id="tInc" rows="4">${escapeHtml(d.tInc || "Boleto aéreo.\nAlojamiento.\nTraslados.\nGestión de reservas.")}</textarea>
        </div>
        <div class="field col-6">
            <label>No Incluye</label>
            <textarea id="tNotInc" rows="4">${escapeHtml(d.tNotInc || "Gastos personales.\nAlimentación no especificada.\nSeguro de viaje.")}</textarea>
        </div>
      </div>

       <div class="field">
        <label>Condiciones</label>
        <textarea id="tCond" rows="2">${escapeHtml(d.tCond || "Depósito no reembolsable.\nCambios sujetos a políticas.")}</textarea>
      </div>
    `,
    onSave: () => {
      // Gather data
      const normalizeClientName = (v) => (v || "").trim().replace(/\s+/g, " ").toLowerCase();
      const clientInputRaw = document.getElementById("qClientSearch").value.trim();
      const normalizedClientInput = normalizeClientName(clientInputRaw);
      let clientObj = normalizedClientInput
        ? state.clients.find(c => normalizeClientName(c.name) === normalizedClientInput)
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
        state.clients.push(clientObj);
        toast("Cliente creado automáticamente en el módulo Clientes.");
      }

      const clientId = clientObj?.id || "";
      const clientName = clientObj?.name || "";
      const clientDisplay = clientInputRaw;

      const destination = document.getElementById("qDest").value.trim();
      const docDate = document.getElementById("qDocDate").value;
      const startDate = document.getElementById("qStart").value;
      const endDate = document.getElementById("qEnd").value;

      // Calc logic logic reuse
      const currency = document.getElementById("qCurrency").value;
      const adults = parseNum(document.getElementById("qAdults").value);
      const children = parseNum(document.getElementById("qChildren").value);
      const priceAd = parseNum(document.getElementById("qPriceAd").value);
      const priceCh = parseNum(document.getElementById("qPriceCh").value);
      const depPct = parseNum(document.getElementById("qDepPct").value);

      const total = (adults * priceAd) + (children * priceCh);
      const deposit = total * (depPct / 100);
      const pricePerPerson = (adults + children) > 0 ? (total / (adults + children)) : 0;

      const datesText = document.getElementById("qDatesText").value;
      const duration = document.getElementById("qDuration").value;
      const paxText = document.getElementById("qPaxText").value.trim();
      const priceNote = document.getElementById("qPriceNote").value.trim();

      const tTransport = document.getElementById("tTransport").value.trim();
      const tLodging = document.getElementById("tLodging").value.trim();
      const tTransfers = document.getElementById("tTransfers").value.trim();
      const tInc = document.getElementById("tInc").value.trim();
      const tNotInc = document.getElementById("tNotInc").value.trim();
      const tCond = document.getElementById("tCond").value.trim();

      const payload = {
        id: isEditing ? existing.id : uid("quo"),
        clientId, clientName, clientDisplay,
        destination, docDate, startDate, endDate,
        datesText, duration, adults, children, paxText,
        currency, priceAd, priceCh, depPct, total, deposit, pricePerPerson,
        priceNote,
        images: currentImages, // Save the array of base64 images
        tTransport, tLodging, tTransfers, tInc, tNotInc, tCond,
        createdAt: isEditing ? (existing.createdAt || new Date().toISOString()) : new Date().toISOString()
      };

      if (isEditing) Object.assign(existing, payload);
      else state.quotations.push(payload);

      saveState(); closeModal();
      if (window.render) window.render();
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
          const promises = files.map(f => resizeImage(f));
          const results = await Promise.all(promises);
          currentImages = currentImages.concat(results).slice(0, MAX_QUOTATION_IMAGES);
          renderPreview();
        } catch (err) {
          alert("Error procesando imágenes");
        } finally {
          e.target.value = "";
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
  if (!confirm("¿Eliminar cotización?")) return;
  state.quotations = state.quotations.filter(x => x.id !== id);
  saveState();
  if (window.render) window.render();
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
  const q = state.quotations.find(x => x.id === id);
  if (!q) return;

  // Defensive close in case export is triggered from any other entry point.
  closeQuotationMenus();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const root = document.getElementById("pdf-root");
  const s = state.settings;
  const companyRaw = (s.companyName || "Brianessa Travel | Tu agencia de viajes de confianza").trim();
  const [companyTitlePart, companyTaglinePart] = companyRaw.split("|").map(x => (x || "").trim());
  const companyTitle = companyTitlePart || "Brianessa Travel";
  const companyTagline = companyTaglinePart || "Tu agencia de viajes de confianza";
  const companyLine = `${companyTitle} | ${companyTagline}`.trim();

  // Estilos exactos de stylec.css minificados para asegurar fidelidad visual
  const PDF_STYLES = `
    :root { --ink: #111827; --muted: #6b7280; --line: #e5e7eb; --card: #ffffff; --page: #ffffff; --bg: #f3f4f6; --brand-color: #111827; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; background: #fff; }
    .quotation-pdf-wrap { width: 210mm; margin: 0 auto; }
    .page {
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
    .page:last-child { break-after: auto; page-break-after: auto; }
    .page--first .page__content { padding-top: 2mm; }
    .page__inner {
      height: 100%;
      padding: 4mm 12mm 9mm 12mm;
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 4px;
    }
    .page__content {
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .brand__logo { width: 60px; height: 60px; border-radius: 10px; object-fit: contain; }
    .brand__text { display: flex; flex-direction: column; }
    .brand__title { font-weight: 900; font-size: 15px; color: #111; line-height: 1.1; }
    .brand__sub { color: #6b7280; font-size: 11px; margin-top: 2px; }
    .header__date { font-size: 12px; font-weight: 600; color: #4b5563; }
    .hero { display: grid; grid-template-columns: 1.4fr 0.8fr; gap: 20px; margin-top: 24px; align-items: start; }
    .pill { display: inline-flex; align-items: center; padding: 4px 10px; border: 1px solid #e5e7eb; border-radius: 99px; font-weight: 700; font-size: 10px; text-transform: uppercase; background: #f9fafb; color: #374151; margin-bottom: 8px; }
    .title { margin: 0 0 12px; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; line-height: 1.1; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .chip { flex: 1; min-width: 100px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px 10px; background: #fff; }
    .chip__label { color: #6b7280; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
    .chip__value { font-size: 13px; font-weight: 700; color: #111; }
    .smallnote { font-size: 11px; color: #6b7280; font-style: italic; }
    .pricebox { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .pricebox__top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .pricebox__label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
    .pricebox__price { font-size: 28px; font-weight: 900; color: #111; line-height: 1; margin-top: 4px; }
    .pricebox__row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
    .pricebox__row strong { font-weight: 800; }
    .pricebox__note { margin-top: 10px; font-size: 10px; color: #6b7280; line-height: 1.3; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px; }
    .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; background: #fff; }
    .card__head { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #f3f4f6; }
    .icon { font-size: 18px; }
    .card h3 { margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #111; }
    .list { list-style: none; padding: 0; margin: 0; font-size: 12px; line-height: 1.5; color: #374151; }
    .list li { margin-bottom: 4px; position: relative; padding-left: 0; }
    .footer { margin-top: 0; padding-top: 10px; border-top: 2px solid #f3f4f6; font-size: 10px; color: #4b5563; text-align: center; }
    .footer strong { color: #111; }
    .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; margin-top: 20px; }
    .gallery__img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 12px; border: 1px solid #e5e7eb; background: #f9fafb; }

    /* Visual tuning to match Cotizaciones reference */
    .header { gap: 12px; padding-bottom: 0; border-bottom: none; }
    .rule { border-top: 1px solid #000; margin: 0; }
    .brand__logo { width: 72px; height: 72px; border: 1px solid #e5e7eb; background: #fff; object-fit: contain; border-radius: 10px; }
    .brand__title { font-size: 14px; font-weight: 800; line-height: 1.1; white-space: nowrap; }
    .brand__sub { display: none; }
    .header__date { font-size: 12px; font-weight: 700; color: #111827; }
    .hero { display: grid; grid-template-columns: 1.2fr .8fr; gap: 12px; margin-top: 2px; }
    .pill { font-size: 12px; padding: 8px 14px; border: 1px solid #000; color: #111827; background: #fff; }
    .title { margin: 5px 0 8px; font-size: 42px; letter-spacing: -.4px; font-weight: 900; line-height: 1; }
    .chip { min-width: 120px; border: 1px solid #000; }
    .chip__label { font-size: 11px; letter-spacing: .3px; }
    .chip__value { font-size: 14px; font-weight: 900; margin-top: 4px; }
    .smallnote { font-size: 12px; color: #111827; font-style: normal; margin-top: 4px; }
    .pricebox { border: 1px solid #000; border-radius: 18px; box-shadow: none; padding: 14px; }
    .pricebox__label { font-size: 12px; font-weight: 800; }
    .pricebox__price { font-size: 26px; margin-top: 6px; }
    .pricebox__row { margin-top: 10px; padding-top: 0; border-top: none; font-size: 13px; }
    .pricebox__note { margin-top: 12px; font-size: 12px; color: #111827; line-height: 1.35; }
    .cards { margin-top: 6px; gap: 10px; align-items: stretch; }
    .card { border: 1px solid #000; border-radius: 18px; padding: 12px 12px 10px; height: 100%; }
    .card__head { gap: 10px; margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .icon { width: 44px; height: 44px; border: 1px solid #000; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 18px; background: #fff; }
    .card h3 { margin: 0; font-size: 18px; line-height: 1.1; letter-spacing: -.2px; text-transform: uppercase; font-weight: 900; }
    .list { margin: 10px 0 0; padding: 0 0 0 16px; list-style: disc; font-size: 12.5px; font-weight: 700; line-height: 1.28; }
    .list li { margin: 8px 0; color: #111827; }
    .footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #000; font-size: 10.5px; color: #111827; text-align: center; line-height: 1.24; }
    .footer__brand { margin-bottom: 2px; font-size: 12px; color: #000; font-weight: 700; }
    .footer__row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 1px; }
    .footer strong { color: var(--brand-color); }
  `;

  // Helper templates
  const renderHeader = () => `
    <div class="header">
       <div class="brand">
         ${s.logoDataUrl ? `<img class="brand__logo" src="${s.logoDataUrl}" />` : `<div class="brand__logo" style="background:#222; color:#fff; display:grid; place-items:center; font-weight:900;">BT</div>`}
         <div class="brand__text">
           <div class="brand__title">${escapeHtml(companyLine)}</div>
           <div class="brand__sub"></div>
         </div>
       </div>
       <div class="header__date">Fecha: ${escapeHtml(q.docDate || "")}</div>
    </div>
  `;

  const renderFooter = () => `
    <div class="footer">
       <div class="footer__brand"><strong>${escapeHtml(companyTitle)}</strong> | ${escapeHtml(companyTagline)}</div>
       <div class="footer__row">
         <span>Teléfono: <strong>${escapeHtml(s.phone || "")}</strong></span>
         <span>Correo electrónico: <strong>${escapeHtml(s.email || "")}</strong></span>
       </div>
       <div class="footer__row">
         <span>Redes sociales: <strong>Instagram: ${escapeHtml(s.instagram || "")} Facebook: ${escapeHtml(s.facebook || "")}</strong></span>
       </div>
       <div>Sitio web: <strong>${escapeHtml(s.website || "")}</strong></div>
    </div>
  `;

  const renderGallery = () => {
    if (!q.images || !q.images.length) return "";
    const imgs = q.images.slice(0, 6).map(src => `<img class="gallery__img" src="${src}" />`).join("");
    return `<div class="gallery">${imgs}</div>`;
  };

  const lines = (txt) => (txt || "").split('\n').filter(x => x.trim()).map(x => `<li>${escapeHtml(x)}</li>`).join("");

  // CONTENT PAGE 1
  const page1 = `
    <div class="page page--first">
      <div class="page__inner">
        ${renderHeader()}
        <div class="rule"></div>
        <div class="page__content">
          <!-- HERO -->
          <div class="hero">
             <div class="hero__left">
                <div class="pill">Cotización de Viaje</div>
                <h1 class="title">${escapeHtml(q.destination)}</h1>
                
                <div class="chips">
                  <div class="chip">
                    <div class="chip__label">Fechas</div>
                    <div class="chip__value">${escapeHtml(q.datesText || "Por definir")}</div>
                  </div>
                  <div class="chip">
                    <div class="chip__label">Duración</div>
                    <div class="chip__value">${escapeHtml(q.duration || "")}</div>
                  </div>
                  <div class="chip">
                    <div class="chip__label">Pasajeros</div>
                    <div class="chip__value">${escapeHtml(q.paxText || `${q.adults} adultos`)}</div>
                  </div>
                </div>
                <div class="smallnote">*Detalles de hotel y vuelos se entregan al confirmar la reserva.</div>
             </div>

             <div class="hero__right">
                <div class="pricebox">
                   <div class="pricebox__top">
                      <div>
                        <div class="pricebox__label">Inversión por persona</div>
                        <div class="pricebox__price">${toMoney(q.pricePerPerson, q.currency)}</div>
                      </div>
                      <div class="pill">${escapeHtml(q.currency)}</div>
                   </div>
                   <div class="pricebox__row">
                      <span>Total Grupo</span> <strong>${toMoney(q.total, q.currency)}</strong>
                   </div>
                   ${q.deposit > 0 ? `<div class="pricebox__row"><span>Reserva con</span> <strong>${toMoney(q.deposit, q.currency)}</strong></div>` : ''}
                   <div class="pricebox__note">${escapeHtml(q.priceNote || "")}</div>
                </div>
             </div>
          </div>

          <div class="cards">
             <div class="card">
                <div class="card__head"><span class="icon">✈️</span><h3>Transporte</h3></div>
                <ul class="list">${lines(q.tTransport)}</ul>
             </div>
             <div class="card">
                <div class="card__head"><span class="icon">🏨</span><h3>Alojamiento</h3></div>
                <ul class="list">${lines(q.tLodging)}</ul>
             </div>
             <div class="card">
                <div class="card__head"><span class="icon">🚐</span><h3>Traslados</h3></div>
                <ul class="list">${lines(q.tTransfers)}</ul>
             </div>
          </div>
        </div>

        ${renderFooter()}
      </div>
    </div>
  `;

  // CONTENT PAGE 2
  const page2 = `
    <div class="page">
      <div class="page__inner">
        ${renderHeader()}
        <div class="rule"></div>
        <div class="page__content">
          ${renderGallery()}

          <h3 style="margin-top:20px; text-transform:uppercase; color:#6b7280; font-size:14px;">Detalles del Paquete</h3>
          
          <div class="cards">
             <div class="card">
                <div class="card__head"><span class="icon">✅</span><h3>Incluye</h3></div>
                <ul class="list">${lines(q.tInc)}</ul>
             </div>
             <div class="card">
                <div class="card__head"><span class="icon">❌</span><h3>No Incluye</h3></div>
                <ul class="list">${lines(q.tNotInc)}</ul>
             </div>
             <div class="card">
                <div class="card__head"><span class="icon">📄</span><h3>Condiciones</h3></div>
                <ul class="list">${lines(q.tCond)}</ul>
             </div>
          </div>
        </div>

        ${renderFooter()}
      </div>
    </div>
  `;

  root.innerHTML = `<style>${PDF_STYLES}</style><div class="quotation-pdf-wrap">${page1}${page2}</div>`;

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

  // Small wait to ensure images/layout are ready without visual flicker.
  await new Promise(r => setTimeout(r, 150));

  try {
    if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
      throw new Error("Faltan librerías PDF (jsPDF/html2canvas).");
    }

    const pages = Array.from(root.querySelectorAll(".page"));
    if (!pages.length) throw new Error("No encontré páginas para exportar.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const forceDownloadPDF = () => {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const pageImages = [];
    for (let i = 0; i < pages.length; i++) {
      const canvas = await window.html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.96);
      pageImages.push(imgData);
      if (i > 0) doc.addPage("a4", "portrait");
      doc.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    if (mode === "preview") {
      const pagesHtml = pageImages
        .map((img, idx) => `
          <div style="margin-bottom:14px;">
            <img src="${img}" alt="Página ${idx + 1}" style="width:100%; display:block; border:1px solid rgba(255,255,255,.12); border-radius:10px; background:#fff;" />
          </div>
        `)
        .join("");

      openModal({
        title: "Vista previa de cotización",
        bodyHtml: `
          <div class="card" style="padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
              <div class="kbd">Revisa el documento antes de descargarlo.</div>
              <button class="btn primary" id="btnPreviewDownload">Descargar PDF</button>
            </div>
            <div style="max-height:70vh; overflow:auto;">${pagesHtml}</div>
          </div>
        `,
        onSave: () => closeModal()
      });

      const btnPreviewDownload = document.getElementById("btnPreviewDownload");
      if (btnPreviewDownload) {
        btnPreviewDownload.onclick = () => {
          forceDownloadPDF();
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
  }
}
