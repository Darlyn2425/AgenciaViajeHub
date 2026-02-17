import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal, icon } from "../utils/ui.js";
import { escapeHtml, escapeAttr, matchesSearch, uid, parseNum, toMoney, formatDateLongISO, fileToDataUrl } from "../utils/helpers.js";
import { withTenantQuery, tenantHeaders } from "../utils/tenant.js";
import { getTenantItems, findTenantItem, pushTenantItem, removeTenantItems, upsertTenantItem, replaceTenantItems } from "../utils/tenant-data.js";

window.editItinerary = editItinerary;
window.duplicateItinerary = duplicateItinerary;
window.deleteItinerary = deleteItinerary;
window.viewItinerary = viewItinerary;
window.openItineraryModal = openItineraryModal;
window.exportItineraryPDF = exportItineraryPDF;
window.previewItineraryPDF = previewItineraryPDF;
window.loadPortugalDemoItinerary = loadPortugalDemoItinerary;
window.loadMilanMadridDemoItinerary = loadMilanMadridDemoItinerary;
window.toggleItineraryMenu = toggleItineraryMenu;
window.runItineraryAction = runItineraryAction;

let itineraryPdfBusy = false;
const API_TIMEOUT_MS = 8000;
let itinerariesApiSyncStarted = false;
let itinerariesApiSyncCompleted = false;
let itinerariesIsLoading = false;
let itinerariesLastFetchKey = "";

function getConfiguredItineraryStatuses() {
    const itineraryList = state.settings?.modules?.itineraries?.statuses || [];
    if (itineraryList.length) return itineraryList;
    const quotationList = state.settings?.modules?.quotations?.statuses || [];
    if (quotationList.length) return quotationList;
    return [{ id: "quo_draft", label: "Borrador", color: "#64748b", isDefault: true, isFinal: false, order: 1 }];
}

function getDefaultItineraryStatus() {
    const statuses = getConfiguredItineraryStatuses();
    return statuses.find(s => s.isDefault) || statuses[0];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchItinerariesFromApi({ search = "" } = {}) {
    const params = new URLSearchParams({ page: "1", limit: "200", search: String(search || "") });
    const response = await fetchWithTimeout(withTenantQuery(`/api/itineraries?${params.toString()}`), {
        headers: tenantHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return { items: data.items };
}

async function upsertItineraryToApi(itinerary) {
    const response = await fetchWithTimeout(withTenantQuery("/api/itineraries"), {
        method: "POST",
        headers: tenantHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(itinerary || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.item) throw new Error(data?.error || `HTTP ${response.status}`);
    return data.item;
}

async function deleteItineraryFromApi(id) {
    const response = await fetchWithTimeout(withTenantQuery(`/api/itineraries?id=${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers: tenantHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return true;
}

async function syncItinerariesFromApi(searchTerm = "") {
    const key = String(searchTerm || "").toLowerCase().trim();
    if (itinerariesIsLoading || (itinerariesApiSyncStarted && itinerariesLastFetchKey === key)) return;
    itinerariesApiSyncStarted = true;
    itinerariesIsLoading = true;
    itinerariesLastFetchKey = key;
    try {
        const remote = await fetchItinerariesFromApi({ search: key });
        replaceTenantItems("itineraries", remote.items);
        saveState();
        itinerariesApiSyncCompleted = true;
        if (window.render) window.render();
    } catch (error) {
        console.warn("[itineraries] sync warning:", error?.message || error);
    } finally {
        itinerariesApiSyncStarted = false;
        itinerariesIsLoading = false;
    }
}

function syncItineraryInBackground(payload) {
    upsertItineraryToApi(payload)
        .then((remoteItem) => {
            upsertTenantItem("itineraries", remoteItem);
            saveState();
            if (window.render) window.render();
        })
        .catch((error) => {
            console.warn("[itineraries] upsert warning:", error?.message || error);
        });
}

export function renderItineraries(searchTerm = "") {
    if (!itinerariesApiSyncCompleted || !itinerariesApiSyncStarted) {
        syncItinerariesFromApi(searchTerm);
    }
    const itineraries = getTenantItems("itineraries");
    const filteredCount = itineraries.filter(i => matchesSearch(i, searchTerm)).length;
    const rows = itineraries.filter(i => matchesSearch(i, searchTerm)).map(i => {
        const hasTotal = Number.isFinite(Number(i.total)) && Number(i.total) > 0;
        const totalLabel = hasTotal ? toMoney(Number(i.total), i.currency || "USD") : "—";
        const menuItems = `
          <button class="menu-item" onclick="window.runItineraryAction('preview','${i.id}')">
            <span class="mi-ic">${icon('eye')}</span>
            <span class="mi-tx">Ver PDF</span>
          </button>
          <div class="menu-sep"></div>
          <button class="menu-item" onclick="window.runItineraryAction('download','${i.id}')">
            <span class="mi-ic">${icon('download')}</span>
            <span class="mi-tx">Descargar (PDF)</span>
          </button>
          <div class="menu-sep"></div>
          <button class="menu-item" onclick="window.duplicateItinerary('${i.id}')">
            <span class="mi-ic">${icon('copy')}</span>
            <span class="mi-tx">Duplicar</span>
          </button>
          <div class="menu-sep"></div>
          <button class="menu-item danger" onclick="window.deleteItinerary('${i.id}')">
            <span class="mi-ic">${icon('trash')}</span>
            <span class="mi-tx">Eliminar</span>
          </button>
        `;
        return `
          <tr>
            <td>
              <div class="plan-cell">
                <div class="plan-main">
                  <strong>${escapeHtml(i.destination || i.title || "Itinerario")}</strong>
                </div>
                <div class="kbd">${escapeHtml(i.clientName || i.clientDisplay || "Cliente")}</div>
                ${i.statusLabel ? `<div style="margin-top:6px;"><span class="status-chip">${escapeHtml(i.statusLabel)}</span></div>` : ""}
              </div>
            </td>
            <td>${escapeHtml(i.datesText || "")}</td>
            <td>${escapeHtml(totalLabel)}</td>
            <td>
              <div class="actions compact">
                <button class="icon-btn" onclick="window.viewItinerary('${i.id}')" title="Ver">${icon('eye')}</button>
                <button class="icon-btn" onclick="window.editItinerary('${i.id}')" title="Editar">${icon('edit')}</button>
                <div class="action-menu" data-menu="${i.id}">
                  <button class="icon-btn menu-trigger" onclick="window.toggleItineraryMenu(event,'${i.id}')">${icon('dots')}</button>
                  <div class="menu-pop" id="iti-menu-${i.id}" hidden>
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
      ${renderModuleToolbar("itineraries",
        `<div><h2 style="margin:0;">Itinerarios</h2><div class="kbd">Crea itinerarios detallados con formato visual de cotización.</div></div>`,
        `<button class="btn primary" onclick="window.openItineraryModal()">+ Nuevo itinerario</button>`
    )}
      <hr/>
      <table class="table">
        <thead><tr><th>Destino</th><th>Fechas</th><th>Total</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">${itinerariesIsLoading ? "Cargando itinerarios..." : "No hay itinerarios todavía."}</td></tr>`}</tbody>
      </table>
      <div class="row" style="margin-top:10px;">
        <div class="kbd">Mostrando ${filteredCount ? 1 : 0}-${filteredCount} de ${filteredCount}</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn" disabled>Anterior</button>
          <div class="kbd">Página 1 / 1</div>
          <button class="btn" disabled>Siguiente</button>
        </div>
      </div>
    </div>
  `);
}

function toggleItineraryMenu(e, id) {
    e.stopPropagation();
    const trigger = e.target?.closest(".menu-trigger");
    const menu = document.getElementById(`iti-menu-${id}`);
    if (!menu) return;
    const wasOpen = !menu.hidden;
    closeItineraryMenus();
    if (wasOpen) return;
    menu.hidden = false;
    menu.style.display = "block";
    const actionMenu = trigger?.closest(".action-menu");
    if (actionMenu) actionMenu.classList.add("menu-open");
    const row = trigger?.closest("tr");
    if (row) row.classList.add("menu-open");
}

function closeItineraryMenus() {
    document.querySelectorAll("[id^='iti-menu-']").forEach(el => {
        el.hidden = true;
        el.style.display = "none";
    });
    document.querySelectorAll(".action-menu.menu-open").forEach(el => el.classList.remove("menu-open"));
    document.querySelectorAll(".table tbody tr.menu-open").forEach(el => el.classList.remove("menu-open"));
}

function runItineraryAction(action, id) {
    closeItineraryMenus();
    if (action === "preview") previewItineraryPDF(id);
    else exportItineraryPDF(id);
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".action-menu")) closeItineraryMenus();
});

export function loadPortugalDemoItinerary() {
    const existing = findTenantItem("itineraries", x => x.id === "iti_portugal_demo");
    const payload = {
        id: "iti_portugal_demo",
        title: "TODO PORTUGAL 2026",
        tripId: "",
        tripName: "",
        tripDisplay: "Todo Portugal | Salida Regular / Tour Compartido",
        startDate: "2026-05-25",
        endDate: "2026-06-02",
        price: 1490,
        priceExt: 0,
        depositText: "Reserva con USD 200 por persona. Pago total 45 días antes.",
        ctaLink: "",
        overview: "Circuito de 09 días / 08 noches por Portugal. Recorrido guiado visitando Lisboa, Algarve, Evora, Fatima, Oporto, Braga, Guimaraes, Aveiro, Coimbra, Batalha, Nazare y Obidos.",
        includes: [
            "Traslados aeropuerto - hotel - aeropuerto.",
            "08 noches de alojamiento con desayunos incluidos.",
            "Recorrido en autocar con guía en español y portugués.",
            "Visita panorámica en Lisboa.",
            "Barco en río Duero (Oporto) y paseo en barco en Aveiro con dulce típico.",
            "Traslado nocturno de Plaza de los Restauradores en Lisboa.",
            "Entradas: Capilla de los Huesos, Convento-Castillo de Cristo y Monasterio de Batalha.",
            "Funicular en Bom Jesus (Braga) y elevador a la ciudad antigua de Nazare.",
            "2 cenas incluidas en Fatima y Coimbra.",
            "Seguro de asistencia al viajero (según operador)."
        ],
        excludes: [
            "Boleto internacional desde ciudad de origen.",
            "Almuerzos o cenas no mencionados en el programa.",
            "Tours opcionales.",
            "Propinas.",
            "Servicio de maleteros.",
            "Gastos personales.",
            "Nada no mencionado en la sección Incluye."
        ],
        emirates: ["Portugal"],
        galleryImages: [],
        coverImage: "",
        cover: {
            top: "TODO PORTUGAL",
            middle: "2026",
            bottom: "TRAVEL ITINERARY",
        },
        theme: {
            primary: "#0b3d91",
            secondary: "#1d63c7",
            accent: "#f3c61b",
        },
        flightInfo: {
            airlineOut: "Por confirmar",
            airlineBack: "Por confirmar",
            departureCities: ["Según ciudad de origen del pasajero"],
        },
        days: [
            {
                day: "DAY 1",
                title: "Lisboa",
                content: "Llegada a Lisboa. Traslado al hotel y tiempo libre. En la tarde se entrega información para el inicio del circuito.",
            },
            {
                day: "DAY 2",
                title: "Lisboa",
                content: "Visita panorámica por la capital portuguesa, barrio de Belem y tiempo libre por la tarde para actividades opcionales.",
            },
            {
                day: "DAY 3",
                title: "Lisboa - Lagos - Cabo de San Vicente - Albufeira",
                content: "Salida hacia el Algarve, visita de Lagos, tiempo para almorzar y continuación al Cabo de San Vicente con parada fotográfica en Sagres. Llegada a Albufeira.",
            },
            {
                day: "DAY 4",
                title: "Albufeira - Mertola - Evora",
                content: "Paso por Faro, visita de Mertola y continuación a Evora. Incluye entrada a la Capilla de los Huesos y paseo por la ciudad histórica.",
            },
            {
                day: "DAY 5",
                title: "Evora - Marvao - Castelo de Vide - Tomar - Fatima",
                content: "Ruta por pueblos históricos del Alentejo, visita de Tomar con entrada al Convento de Cristo y parada en Aljustrel antes de llegar a Fatima. Cena incluida.",
            },
            {
                day: "DAY 6",
                title: "Fatima - Oporto",
                content: "Salida al norte y llegada a Oporto. Paseo en barco tradicional rabelo por el río Duero y tiempo libre en la Ribeira.",
            },
            {
                day: "DAY 7",
                title: "Oporto - Braga - Bom Jesus - Guimaraes - Aveiro - Coimbra",
                content: "Visitas en el norte de Portugal, subida en funicular al Santuario de Bom Jesus, paseo en barco moliceiro en Aveiro y llegada a Coimbra. Cena incluida.",
            },
            {
                day: "DAY 8",
                title: "Coimbra - Batalha - Nazare - Obidos - Lisboa",
                content: "Tiempo en Coimbra, entrada al Monasterio de Batalha, parada en Nazare con elevador a la parte alta y visita de Obidos antes de regresar a Lisboa.",
            },
            {
                day: "DAY 9",
                title: "Lisboa - Aeropuerto",
                content: "Desayuno y traslado al aeropuerto a la hora indicada. Fin de servicios.",
            }
        ],
        text: "Demo montado desde TODO PORTUGAL.pdf para validar formato Dubai.",
        updatedAt: new Date().toLocaleString(state.settings.locale),
    };

    if (existing) Object.assign(existing, payload);
    else pushTenantItem("itineraries", payload);

    saveState();
    if (window.render) window.render();
    syncItineraryInBackground(payload);
    setTimeout(() => previewItineraryPDF(payload.id), 120);
}

export function loadMilanMadridDemoItinerary() {
    const existing = findTenantItem("itineraries", x => x.id === "iti_milan_madrid_demo");
    const payload = {
        id: "iti_milan_madrid_demo",
        title: "DE MILAN A MADRID",
        tripId: "",
        tripName: "",
        tripDisplay: "Programa 13 días | Milan - Madrid",
        startDate: "2026-05-01",
        endDate: "2026-05-13",
        price: 3500,
        priceExt: 0,
        depositText: "Para confirmar el tour: USD 450 por persona.",
        ctaLink: "",
        overview: "Circuito europeo de 13 días recorriendo Italia, Francia y España con visitas panorámicas y guía acompañante.",
        includes: [
            "Vuelos internacionales.",
            "Traslado de llegada en Milan y salida en Madrid.",
            "Alojamiento con desayunos en Milan, Venecia, Florencia, Roma, Niza, Barcelona y Madrid.",
            "Guía acompañante.",
            "Visitas con guía local en Venecia, Florencia, Roma y Madrid.",
            "Tasas municipales en Italia, Francia y Barcelona.",
            "Seguro de asistencia al viajero (consultar cobertura)."
        ],
        excludes: [
            "Almuerzos o cenas no mencionados en el programa.",
            "Extras y gastos personales.",
            "Propinas.",
            "Visado.",
            "Nada no mencionado en la sección Incluye."
        ],
        terms: [
            "Pasaporte vigente mínimo 6 meses.",
            "Depósito de reserva según condiciones del tour.",
            "Tarifas sujetas a cambio por disponibilidad.",
            "No reembolsable según políticas del proveedor."
        ],
        emirates: ["Italia", "Francia", "España"],
        galleryImages: [],
        coverImage: "",
        cover: {
            top: "DE MILAN A",
            middle: "MADRID",
            bottom: "13 DIAS",
        },
        theme: {
            primary: "#0b3d91",
            secondary: "#1d63c7",
            accent: "#f3c61b",
        },
        flightInfo: {
            airlineOut: "Por confirmar",
            airlineBack: "Por confirmar",
            departureCities: ["América (según ciudad de salida)"],
        },
        days: [
            { day: "DÍA 1", title: "América - Milan", meals: "Ninguna", content: "Salida en vuelo intercontinental hacia Milán. Noche a bordo." },
            { day: "DÍA 2", title: "Milan", meals: "Desayuno", content: "Llegada, asistencia y traslado al hotel. Resto del día libre." },
            { day: "DÍA 3", title: "Milan - Venecia", meals: "Desayuno", content: "Mañana libre en Milan y salida por la tarde hacia Venecia." },
            { day: "DÍA 4", title: "Venecia - Florencia", meals: "Desayuno", content: "Visita panorámica de Venecia y continuación a Florencia." },
            { day: "DÍA 5", title: "Florencia - Roma", meals: "Desayuno", content: "Visita panorámica de Florencia y salida hacia Roma." },
            { day: "DÍA 6", title: "Roma", meals: "Desayuno", content: "Visita panorámica de la ciudad imperial y tarde libre." },
            { day: "DÍA 7", title: "Roma", meals: "Desayuno", content: "Día libre. Excursiones opcionales a Nápoles, Capri y Pompeya." },
            { day: "DÍA 8", title: "Roma - Pisa - Niza", meals: "Desayuno", content: "Parada en Pisa y continuación a Niza por la Costa Azul." },
            { day: "DÍA 9", title: "Niza - Barcelona", meals: "Desayuno", content: "Ruta hacia Barcelona y panorámica de la ciudad." },
            { day: "DÍA 10", title: "Barcelona - Zaragoza - Madrid", meals: "Desayuno", content: "Salida a Madrid con parada en Zaragoza." },
            { day: "DÍA 11", title: "Madrid", meals: "Desayuno", content: "Visita panorámica de Madrid y tiempo libre." },
            { day: "DÍA 12", title: "Madrid - Día extra", meals: "Desayuno", content: "Día libre para actividades personales en Madrid." },
            { day: "DÍA 13", title: "Madrid", meals: "Desayuno", content: "Traslado al aeropuerto a la hora indicada. Fin de servicios." }
        ],
        text: "Demo montado desde Itinerario Milan - Madrid.pdf para validar nuevo formato simple.",
        updatedAt: new Date().toLocaleString(state.settings.locale),
    };

    if (existing) Object.assign(existing, payload);
    else pushTenantItem("itineraries", payload);

    saveState();
    if (window.render) window.render();
    syncItineraryInBackground(payload);
    setTimeout(() => previewItineraryPDF(payload.id), 120);
}

export function openItineraryModal(existing = null) {
    const isEditing = !!existing;
    const MAX_ITINERARY_IMAGES = 6;
    const statuses = getConfiguredItineraryStatuses();
    const defaultStatus = getDefaultItineraryStatus();
    const currentStatusId = existing?.statusId || defaultStatus.id;
    const clients = getTenantItems("clients");
    const clientOptions = clients.map(c => `<option value="${escapeHtml(c.name || c.clientDisplay || "")}"></option>`).join("");
    const parseISODate = (iso) => {
        const [y, m, d] = String(iso || "").split("-").map(Number);
        if (!y || !m || !d) return null;
        return { y, m, d };
    };
    const toDateChip = (startIso, endIso) => {
        const start = parseISODate(startIso);
        const end = parseISODate(endIso);
        if (!start || !end) return "";
        const mo = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return `${start.d} ${mo[start.m - 1]} - ${end.d} ${mo[end.m - 1]} ${end.y}`;
    };
    const toNights = (startIso, endIso) => {
        const start = parseISODate(startIso);
        const end = parseISODate(endIso);
        if (!start || !end) return "";
        const startUTC = Date.UTC(start.y, start.m - 1, start.d);
        const endUTC = Date.UTC(end.y, end.m - 1, end.d);
        const diff = endUTC - startUTC;
        const nights = Math.round(diff / 86400000);
        return nights >= 0 ? `${nights} noches` : "";
    };
    const renderItineraryDayRow = (day = {}, idx = 0) => `
      <div class="q-it-day-item card" data-day-index="${idx}" style="margin-top:10px; padding:10px;">
        <div class="grid">
          <div class="field col-3">
            <label>Día</label>
            <input class="q-it-day-label" value="${escapeHtml(day.day || `DÍA ${idx + 1}`)}" />
          </div>
          <div class="field col-9">
            <label>Título</label>
            <input class="q-it-day-title" value="${escapeHtml(day.title || "")}" placeholder="Ej: AMÉRICA - MILÁN" />
          </div>
        </div>
        <div class="grid">
          <div class="field col-8">
            <label>Texto del día</label>
            <textarea class="q-it-day-text" rows="4" placeholder="Describe las actividades del día...">${escapeHtml(day.text || day.content || "")}</textarea>
          </div>
          <div class="field col-4">
            <label>Comidas incluidas</label>
            <input class="q-it-day-meals" value="${escapeHtml(day.meals || "")}" placeholder="Ej: Desayuno" />
            <label style="margin-top:8px;">Imagen del día</label>
            <input class="q-it-day-image-input" type="file" accept="image/*" />
            <input class="q-it-day-image-value" type="hidden" value="${escapeAttr(day.image || "")}" />
            <div class="q-it-day-preview" style="margin-top:6px;">
              ${day.image ? `<img class="q-it-day-image-preview" src="${escapeAttr(day.image)}" style="width:100%; max-width:180px; height:90px; object-fit:cover; border:1px solid rgba(255,255,255,.18); border-radius:8px;" />` : `<div class="kbd">Sin imagen</div>`}
            </div>
          </div>
        </div>
        <div class="q-it-day-actions" style="margin-top:8px;">
          <button type="button" class="btn danger q-it-day-remove">Quitar día</button>
        </div>
      </div>
    `;

    const initialDays = Array.isArray(existing?.days) && existing.days.length ? existing.days : [{}];
    let currentImages = Array.isArray(existing?.galleryImages) ? [...existing.galleryImages] : [];
    const inferredAdults = Number.isFinite(Number(existing?.adults)) ? Number(existing.adults) : 2;
    const inferredChildren = Number.isFinite(Number(existing?.children)) ? Number(existing.children) : 0;
    const datesText = existing?.datesText || toDateChip(existing?.startDate, existing?.endDate);
    const duration = existing?.duration || toNights(existing?.startDate, existing?.endDate);
    const paxText = existing?.paxText || `${inferredAdults} adultos${inferredChildren ? `, ${inferredChildren} niños` : ""}`;

    const renderImageThumbs = () => {
        if (!currentImages.length) return `<div class="kbd">Sin imágenes cargadas.</div>`;
        return currentImages.map((src, idx) => `
          <div class="card" style="padding:6px; width:132px;">
            <img src="${escapeAttr(src)}" style="width:100%; height:78px; object-fit:cover; border-radius:8px;" />
            <button type="button" class="btn danger" data-i-remove="${idx}" style="margin-top:6px; width:100%;">Quitar</button>
          </div>
        `).join("");
    };

    openModal({
        title: isEditing ? "Editar itinerario" : "Nuevo itinerario",
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
              <input id="iClientSearch" list="iClientList" value="${escapeHtml(existing?.clientName || existing?.clientDisplay || "")}" placeholder="Escribe para buscar. Si no existe, se creará al guardar." />
              <datalist id="iClientList">${clientOptions}</datalist>
              <div class="kbd" style="margin-top:6px;">Si el nombre no existe en clientes, se agrega automáticamente.</div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">2</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Datos del Viaje</h4>
              <p class="form-section__hint">Destino, fechas y pasajeros para crear el itinerario.</p>
            </div>
          </div>
          <div class="grid">
            <div class="field col-6">
              <label>Destino <span class="req">*</span></label>
              <input id="iDest" value="${escapeHtml(existing?.destination || existing?.title || "")}" placeholder="Ej: Punta Cana" />
            </div>
            <div class="field col-6">
              <label>Fecha Documento</label>
              <input id="iDocDate" type="date" value="${escapeHtml(existing?.docDate || new Date().toISOString().slice(0, 10))}" />
            </div>
          </div>
          <div class="grid">
            <div class="field col-6">
              <label>Estado</label>
              <select id="iStatus">
                ${statuses.map(st => `<option value="${escapeHtml(st.id)}" ${st.id === currentStatusId ? "selected" : ""}>${escapeHtml(st.label)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="grid">
            <div class="field col-6"><label>Llegada <span class="req">*</span></label><input id="iStart" type="date" value="${escapeHtml(existing?.startDate || "")}" /></div>
            <div class="field col-6"><label>Salida <span class="req">*</span></label><input id="iEnd" type="date" value="${escapeHtml(existing?.endDate || "")}" /></div>
          </div>
          <div class="grid">
            <div class="field col-3"><label>Chip Fechas (auto)</label><input id="iDatesText" value="${escapeHtml(datesText || "")}" readonly /></div>
            <div class="field col-3"><label>Duración (auto)</label><input id="iDuration" value="${escapeHtml(duration || "")}" readonly /></div>
            <div class="field col-3"><label>Adultos</label><input id="iAdults" type="number" min="0" value="${inferredAdults}" /></div>
            <div class="field col-3"><label>Niños</label><input id="iChildren" type="number" min="0" value="${inferredChildren}" /></div>
          </div>
          <div class="field">
            <label>Texto Pasajeros (opcional)</label>
            <input id="iPaxText" value="${escapeHtml(paxText)}" placeholder="Ej: 2 adultos, 1 niño (pedrito)" />
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">4</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Imágenes</h4>
              <p class="form-section__hint">Opcional. Puedes cargar y quitar fotos.</p>
            </div>
          </div>
          <div class="field">
            <label>Fotos del Hospedaje/Destino (Max ${MAX_ITINERARY_IMAGES})</label>
            <input type="file" id="iImagesInput" multiple accept="image/*" />
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:8px;">
              <div class="kbd">Puedes quitar y volver a cargar fotos.</div>
              <button type="button" class="btn ghost" id="iImagesClearAll">Quitar todas</button>
            </div>
            <div id="iImagesPreview" style="display:flex; gap:10px; margin-top:10px; overflow-x:auto; flex-wrap:wrap;">
              ${renderImageThumbs()}
            </div>
          </div>
          <div class="field">
            <label>Imagen portada</label>
            <input id="iCoverImageFile" type="file" accept="image/*" />
            <input id="iCoverImage" type="hidden" value="${escapeAttr(existing?.coverImage || "")}" />
            <div style="display:flex; justify-content:flex-end; margin-top:8px;">
              <button type="button" class="btn ghost" id="iCoverImageClear">Quitar portada</button>
            </div>
            <div style="margin-top:8px;">
              ${existing?.coverImage ? `<img id="iCoverPreview" src="${escapeAttr(existing.coverImage)}" style="width:100%; max-height:180px; object-fit:cover; border-radius:10px; border:1px solid rgba(255,255,255,.18);" />` : `<div id="iCoverPreview" class="kbd">Sin imagen seleccionada.</div>`}
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
          <div class="field"><label>Transporte y Vuelos</label><textarea id="iTransport" rows="3">${escapeHtml(existing?.tTransport || "")}</textarea></div>
          <div class="field"><label>Alojamiento</label><textarea id="iLodging" rows="3">${escapeHtml(existing?.tLodging || "")}</textarea></div>
          <div class="field"><label>Traslados</label><textarea id="iTransfers" rows="2">${escapeHtml(existing?.tTransfers || "")}</textarea></div>
          <div class="grid">
            <div class="field col-6"><label>Incluye</label><textarea id="iIncludes" rows="4">${escapeHtml((existing?.includes || []).join("\n"))}</textarea></div>
            <div class="field col-6"><label>No Incluye</label><textarea id="iExcludes" rows="4">${escapeHtml((existing?.excludes || []).join("\n"))}</textarea></div>
          </div>
          <div class="field"><label>Condiciones</label><textarea id="iTerms" rows="2">${escapeHtml((existing?.terms || []).join("\n"))}</textarea></div>
          <div class="field">
            <label>Link de reservación (pago)</label>
            <input id="iLink" value="${escapeHtml(existing?.ctaLink || "")}" placeholder="https://..." />
            <div class="kbd" style="margin-top:6px;">En el PDF se mostrará como: "Haz clic aquí para reservar".</div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section__head">
            <span class="form-section__index">6</span>
            <div class="form-section__meta">
              <h4 class="form-section__title">Itinerario por Días (Opcional)</h4>
              <p class="form-section__hint">Si activas esta opción, el PDF agrega sección día a día con imagen.</p>
            </div>
          </div>
          <div class="field">
            <label style="display:flex; align-items:center; gap:8px;">
              <input id="iEnableItinerary" type="checkbox" ${(existing?.itineraryEnabled ?? true) ? "checked" : ""} />
              Habilitar itinerario por días en PDF
            </label>
          </div>
          <div id="iItineraryWrap" style="${(existing?.itineraryEnabled ?? true) ? "" : "display:none;"}">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <div class="kbd">Añade los días que necesites. Cada día acepta 1 imagen.</div>
              <button type="button" class="btn" id="iAddItineraryDay">+ Agregar día</button>
            </div>
            <div id="iItineraryList">
              ${(initialDays.length ? initialDays : [{}]).map((day, idx) => renderItineraryDayRow(day, idx)).join("")}
            </div>
          </div>
        </div>
      </div>
    `,
        onSave: () => {
            const gv = (id) => (document.getElementById(id)?.value ?? "");
            const gvt = (id) => gv(id).trim();

            const normalizeName = (v) => (v || "").trim().replace(/\s+/g, " ").toLowerCase();
            const clientInput = gvt("iClientSearch");
            const normalizedClientInput = normalizeName(clientInput);
            let clientObj = normalizedClientInput
                ? findTenantItem("clients", c => normalizeName(c.name) === normalizedClientInput)
                : null;
            if (!clientObj && clientInput) {
                clientObj = pushTenantItem("clients", { id: uid("cli"), name: clientInput, phone: "", email: "", tripId: "", tripName: "" });
            }

            const destination = gvt("iDest");
            const startDate = gv("iStart");
            const endDate = gv("iEnd");
            if (!clientInput) { alert("Completa el cliente."); return; }
            if (!destination) { alert("Completa el destino."); return; }
            if (!startDate || !endDate) { alert("Completa llegada y salida."); return; }

            const selectedStatusId = gv("iStatus");
            const selectedStatus = statuses.find(st => st.id === selectedStatusId) || defaultStatus;
            const adults = parseNum(gv("iAdults"));
            const children = parseNum(gv("iChildren"));
            const itineraryEnabled = !!document.getElementById("iEnableItinerary")?.checked;
            const days = itineraryEnabled
                ? Array.from(document.querySelectorAll("#iItineraryList .q-it-day-item"))
                    .map((row, idx) => {
                        const getVal = (selector) => ((row.querySelector(selector)?.value || "").trim());
                        const day = getVal(".q-it-day-label") || `DÍA ${idx + 1}`;
                        const title = getVal(".q-it-day-title");
                        const text = getVal(".q-it-day-text");
                        const meals = getVal(".q-it-day-meals");
                        const image = row.querySelector(".q-it-day-image-value")?.value || "";
                        return { day, title, content: text, text, meals, image };
                    })
                    .filter(item => item.title || item.text || item.meals || item.image)
                : [];

            const payload = {
                id: existing?.id || uid("iti"),
                clientId: clientObj?.id || "",
                clientName: clientObj?.name || "",
                clientDisplay: clientInput,
                statusId: selectedStatus?.id || "",
                statusLabel: selectedStatus?.label || "",
                destination,
                title: destination,
                tripId: existing?.tripId || "",
                tripName: existing?.tripName || "",
                tripDisplay: destination,
                docDate: gv("iDocDate"),
                startDate,
                endDate,
                datesText: gv("iDatesText"),
                duration: gv("iDuration"),
                adults,
                children,
                paxText: gvt("iPaxText"),
                currency: existing?.currency || "USD",
                total: 0,
                tTransport: gvt("iTransport"),
                tLodging: gvt("iLodging"),
                tTransfers: gvt("iTransfers"),
                ctaLink: gvt("iLink"),
                includes: splitLines(gv("iIncludes")),
                excludes: splitLines(gv("iExcludes")),
                terms: splitLines(gv("iTerms")),
                galleryImages: currentImages.slice(0, MAX_ITINERARY_IMAGES),
                coverImage: gv("iCoverImage"),
                flightInfo: existing?.flightInfo || { airlineOut: "", airlineBack: "", departureCities: [] },
                itineraryEnabled,
                days,
                updatedAt: new Date().toLocaleString(state.settings.locale),
            };

            if (existing) Object.assign(existing, payload);
            else pushTenantItem("itineraries", payload);

            saveState();
            closeModal();
            if (window.render) window.render();
            syncItineraryInBackground(payload);
        }
    });

    const refreshImagePreview = () => {
        const host = document.getElementById("iImagesPreview");
        if (!host) return;
        host.innerHTML = renderImageThumbs();
        host.querySelectorAll("[data-i-remove]").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = Number(btn.getAttribute("data-i-remove"));
                if (Number.isNaN(idx)) return;
                currentImages = currentImages.filter((_, i) => i !== idx);
                refreshImagePreview();
            });
        });
    };
    refreshImagePreview();

    const recalcDates = () => {
        const startDate = document.getElementById("iStart")?.value || "";
        const endDate = document.getElementById("iEnd")?.value || "";
        const dates = toDateChip(startDate, endDate);
        const duration = toNights(startDate, endDate);
        const datesInput = document.getElementById("iDatesText");
        const durationInput = document.getElementById("iDuration");
        if (datesInput) datesInput.value = dates;
        if (durationInput) durationInput.value = duration;
    };
    const recalcPax = () => {
        const adults = parseNum(document.getElementById("iAdults")?.value || "0");
        const children = parseNum(document.getElementById("iChildren")?.value || "0");
        const paxInput = document.getElementById("iPaxText");
        if (!paxInput || paxInput.value.trim()) return;
        paxInput.value = `${adults} adultos${children ? `, ${children} niños` : ""}`;
    };
    const startEl = document.getElementById("iStart");
    const endEl = document.getElementById("iEnd");
    if (startEl) startEl.addEventListener("change", recalcDates);
    if (endEl) endEl.addEventListener("change", recalcDates);
    const adultsEl = document.getElementById("iAdults");
    const childrenEl = document.getElementById("iChildren");
    if (adultsEl) adultsEl.addEventListener("input", recalcPax);
    if (childrenEl) childrenEl.addEventListener("input", recalcPax);

    const itineraryToggle = document.getElementById("iEnableItinerary");
    const itineraryWrap = document.getElementById("iItineraryWrap");
    if (itineraryToggle && itineraryWrap) {
        itineraryToggle.addEventListener("change", () => {
            itineraryWrap.style.display = itineraryToggle.checked ? "" : "none";
        });
    }

    const bindDayRow = (row) => {
        const removeBtn = row.querySelector(".q-it-day-remove");
        const imageInput = row.querySelector(".q-it-day-image-input");
        const imageValue = row.querySelector(".q-it-day-image-value");
        const previewHost = row.querySelector(".q-it-day-preview");
        if (removeBtn) {
            removeBtn.addEventListener("click", () => row.remove());
        }
        if (imageInput && imageValue && previewHost) {
            imageInput.addEventListener("change", async (ev) => {
                const file = ev.target.files && ev.target.files[0];
                if (!file) return;
                const dataUrl = await fileToDataUrl(file, 1600, 1200);
                imageValue.value = dataUrl;
                previewHost.innerHTML = `<img class="q-it-day-image-preview" src="${escapeAttr(dataUrl)}" style="width:100%; max-width:180px; height:90px; object-fit:cover; border:1px solid rgba(255,255,255,.18); border-radius:8px;" />`;
            });
        }
    };
    document.querySelectorAll("#iItineraryList .q-it-day-item").forEach(bindDayRow);
    const addDayBtn = document.getElementById("iAddItineraryDay");
    if (addDayBtn) {
        addDayBtn.addEventListener("click", () => {
            const list = document.getElementById("iItineraryList");
            if (!list) return;
            const idx = list.querySelectorAll(".q-it-day-item").length;
            const holder = document.createElement("div");
            holder.innerHTML = renderItineraryDayRow({}, idx);
            const row = holder.firstElementChild;
            if (!row) return;
            list.appendChild(row);
            bindDayRow(row);
        });
    }

    const imagesInput = document.getElementById("iImagesInput");
    if (imagesInput) {
        imagesInput.addEventListener("change", async (ev) => {
            const files = Array.from(ev.target.files || []);
            if (!files.length) return;
            const urls = await Promise.all(files.map(f => fileToDataUrl(f, 1800, 1800)));
            currentImages = currentImages.concat(urls).slice(0, MAX_ITINERARY_IMAGES);
            refreshImagePreview();
        });
    }
    const clearImagesBtn = document.getElementById("iImagesClearAll");
    if (clearImagesBtn) {
        clearImagesBtn.addEventListener("click", () => {
            currentImages = [];
            refreshImagePreview();
        });
    }
    const coverInput = document.getElementById("iCoverImageFile");
    if (coverInput) {
        coverInput.addEventListener("change", async (ev) => {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            const dataUrl = await fileToDataUrl(file, 1800, 2400);
            const hidden = document.getElementById("iCoverImage");
            if (hidden) hidden.value = dataUrl;
            const preview = document.getElementById("iCoverPreview");
            if (preview) preview.outerHTML = `<img id="iCoverPreview" src="${escapeAttr(dataUrl)}" style="width:100%; max-height:180px; object-fit:cover; border-radius:10px; border:1px solid rgba(255,255,255,.18);" />`;
        });
    }
    const clearCoverBtn = document.getElementById("iCoverImageClear");
    if (clearCoverBtn) {
        clearCoverBtn.addEventListener("click", () => {
            const hidden = document.getElementById("iCoverImage");
            if (hidden) hidden.value = "";
            const input = document.getElementById("iCoverImageFile");
            if (input) input.value = "";
            const preview = document.getElementById("iCoverPreview");
            if (preview) preview.outerHTML = `<div id="iCoverPreview" class="kbd">Sin imagen seleccionada.</div>`;
        });
    }
}

export function editItinerary(id) {
    const i = findTenantItem("itineraries", x => x.id === id);
    if (i) openItineraryModal(i);
}

export function duplicateItinerary(id) {
    const source = findTenantItem("itineraries", x => x.id === id);
    if (!source) return;
    closeItineraryMenus();
    const draft = typeof structuredClone === "function"
        ? structuredClone(source)
        : JSON.parse(JSON.stringify(source));
    delete draft.id;
    delete draft.createdAt;
    delete draft.updatedAt;
    setTimeout(() => openItineraryModal(draft), 0);
}

export function deleteItinerary(id) {
    const backup = findTenantItem("itineraries", x => x.id === id);
    removeTenantItems("itineraries", x => x.id === id);
    saveState();
    if (window.render) window.render();
    deleteItineraryFromApi(id).catch((error) => {
        if (backup) upsertTenantItem("itineraries", backup);
        saveState();
        if (window.render) window.render();
        console.warn("[itineraries] delete warning:", error?.message || error);
    });
}

export function viewItinerary(id) {
    const i = findTenantItem("itineraries", x => x.id === id);
    if (!i) return;
    openModal({
        title: "Ver itinerario",
        bodyHtml: `
      <div class="card">
        <div class="row">
          <div>
            <strong>${escapeHtml(i.title)}</strong>
            <div class="kbd">${escapeHtml(i.tripName || i.tripDisplay || "")}</div>
          </div>
          <span class="badge">${(i.days || []).length} días</span>
        </div>
        <hr/>
        <div class="field"><label>Texto</label><textarea readonly>${escapeHtml(i.text || "")}</textarea></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn" id="copyIti">Copiar</button>
          <button class="btn" id="previewItiPdf">Vista PDF</button>
          <button class="btn primary" id="downloadItiPdf">Descargar PDF</button>
        </div>
      </div>
    `,
        onSave: () => closeModal()
    });
    document.getElementById("copyIti").onclick = () => navigator.clipboard.writeText(i.text || "");
    document.getElementById("previewItiPdf").onclick = () => previewItineraryPDF(id);
    document.getElementById("downloadItiPdf").onclick = () => exportItineraryPDF(id);
}

export async function exportItineraryPDF(id) {
    return generateItineraryPDF(id, "download");
}

export async function previewItineraryPDF(id) {
    return generateItineraryPDF(id, "preview");
}

async function generateItineraryPDF(id, mode = "download") {
    if (itineraryPdfBusy) return;
    itineraryPdfBusy = true;

    const itinerary = findTenantItem("itineraries", x => x.id === id);
    const root = document.getElementById("pdf-root");
    if (!itinerary || !root) {
        itineraryPdfBusy = false;
        return;
    }

    const s = state.settings;
    const companyRaw = (s.companyName || "Brianessa Travel | Tu agencia de viajes de confianza").trim();
    const [companyTitlePart, companyTaglinePart] = companyRaw.split("|").map(x => (x || "").trim());
    const companyTitle = companyTitlePart || "Brianessa Travel";
    const companyTagline = companyTaglinePart || "Tu agencia de viajes de confianza";
    const companyLine = `${companyTitle} | ${companyTagline}`.trim();
    const tripName = itinerary.tripDisplay || itinerary.tripName || itinerary.title || "Itinerario de Viaje";
    const cover = itinerary.cover || {};
    const itineraryDays = Array.isArray(itinerary.days) ? itinerary.days : [];

    const parseISODate = (iso = "") => {
        const [y, m, d] = String(iso || "").split("-").map(Number);
        if (!y || !m || !d) return null;
        return { y, m, d };
    };
    const formatShortSpan = (startIso = "", endIso = "") => {
        const start = parseISODate(startIso);
        const end = parseISODate(endIso);
        if (!start || !end) return "Por definir";
        const mo = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return `${start.d} ${mo[start.m - 1]} - ${end.d} ${mo[end.m - 1]} ${end.y}`;
    };
    const calculateNights = (startIso = "", endIso = "") => {
        const start = parseISODate(startIso);
        const end = parseISODate(endIso);
        if (!start || !end) return "";
        const startUTC = Date.UTC(start.y, start.m - 1, start.d);
        const endUTC = Date.UTC(end.y, end.m - 1, end.d);
        const diff = endUTC - startUTC;
        const nights = Math.round(diff / 86400000);
        return nights >= 0 ? `${nights} noches` : "";
    };
    const datesText = formatShortSpan(itinerary.startDate, itinerary.endDate);
    const durationText = calculateNights(itinerary.startDate, itinerary.endDate) || (itineraryDays.length ? `${itineraryDays.length} días` : "Por definir");
    const paxText = itinerary.paxText || itinerary.passengersText || "Por definir";
    const docDate = new Date().toLocaleDateString(s.locale || "es-DO");
    const coverMainTitle = (cover.top || itinerary.title || "ITINERARIO").toString().trim();
    const coverSubTitle = (cover.middle || tripName || "").toString().trim();
    const showCoverSubtitle = !!coverSubTitle && coverSubTitle.toLowerCase() !== coverMainTitle.toLowerCase();

    const richToHtml = (txt = "") => escapeHtml(String(txt || "")).replace(/\n/g, "<br/>");
    const listFromLines = (lines = []) => lines.map(line => `<li>${richToHtml(line)}</li>`).join("");
    const linesFromOverview = splitLines(String(itinerary.overview || ""));
    const airlineOut = itinerary.flightInfo?.airlineOut ? `Ida: ${itinerary.flightInfo.airlineOut}` : "";
    const airlineBack = itinerary.flightInfo?.airlineBack ? `Regreso: ${itinerary.flightInfo.airlineBack}` : "";
    const departureCities = (itinerary.flightInfo?.departureCities || []).filter(Boolean);
    const customTransportLines = splitLines(String(itinerary.tTransport || ""));
    const customLodgingLines = splitLines(String(itinerary.tLodging || ""));
    const customTransferLines = splitLines(String(itinerary.tTransfers || ""));
    const transportLines = customTransportLines.length
        ? customTransportLines
        : [airlineOut, airlineBack, departureCities.length ? `Salidas: ${departureCities.join(", ")}` : ""].filter(Boolean);
    const includeLines = (itinerary.includes || []).filter(Boolean);
    const lodgingLines = customLodgingLines.length
        ? customLodgingLines
        : includeLines.filter(x => /hotel|alojamiento|hospedaje|habitaci/i.test(String(x))).slice(0, 6);
    const transferLines = customTransferLines.length
        ? customTransferLines
        : includeLines.filter(x => /traslado|transfer|movilidad|transporte/i.test(String(x))).slice(0, 6);
    const fallbackProgram = [
        itineraryDays.length ? `${itineraryDays.length} días de itinerario` : "",
        (itinerary.emirates || []).length ? `Destinos: ${(itinerary.emirates || []).join(", ")}` : "",
        itinerary.depositText || ""
    ].filter(Boolean);

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
      .qpdf-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 0; border-bottom: none; }
      .qpdf-brand { display: flex; gap: 12px; align-items: center; }
      .qpdf-brand__logo { width: 72px; height: 72px; border: 1px solid #e5e7eb; background: #fff; object-fit: contain; border-radius: 10px; }
      .qpdf-brand__text { display: flex; flex-direction: column; }
      .qpdf-brand__title { font-size: 14px; font-weight: 800; line-height: 1.1; white-space: nowrap; }
      .qpdf-brand__sub { display: none; }
      .qpdf-header__date { font-size: 12px; font-weight: 700; color: #111827; }
      .qpdf-rule { border-top: 1px solid #000; margin: 0; }
      .qpdf-hero { margin-top: 2px; }
      .qpdf-hero--center { display: flex; flex-direction: column; align-items: center; text-align: center; }
      .qpdf-pill { display: inline-flex; align-items: center; font-size: 12px; padding: 8px 14px; border: 1px solid #000; color: #111827; background: #fff; border-radius: 999px; font-weight: 700; text-transform: uppercase; }
      .qpdf-title { margin: 6px 0 8px; font-size: 42px; letter-spacing: -.4px; font-weight: 900; line-height: 1; }
      .qpdf-title--sub { margin: 0 0 10px; font-size: 24px; letter-spacing: -.2px; font-weight: 800; line-height: 1.1; }
      .qpdf-chips { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
      .qpdf-chips--center { justify-content: center; max-width: 175mm; margin: 0 auto; }
      .qpdf-chip { min-width: 120px; border: 1px solid #000; border-radius: 12px; padding: 8px 10px; background: #fff; text-align: center; }
      .qpdf-chip__label { font-size: 11px; letter-spacing: .3px; color: #4b5563; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
      .qpdf-chip__value { font-size: 14px; font-weight: 900; margin-top: 4px; color: #111827; }
      .qpdf-smallnote { font-size: 12px; color: #111827; font-style: normal; margin-top: 6px; }
      .qpdf-cards { margin-top: 10px; gap: 10px; align-items: stretch; display: grid; grid-template-columns: repeat(3, 1fr); }
      .qpdf-card { border: 1px solid #000; border-radius: 18px; padding: 12px 12px 10px; height: 100%; background: #fff; }
      .qpdf-card__head { gap: 10px; margin-bottom: 0; padding-bottom: 0; border-bottom: none; display: flex; align-items: center; }
      .qpdf-icon { width: 44px; height: 44px; border: 1px solid #000; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 18px; background: #fff; }
      .qpdf-card h3 { margin: 0; font-size: 18px; line-height: 1.1; letter-spacing: -.2px; text-transform: uppercase; font-weight: 900; }
      .qpdf-list { margin: 10px 0 0; padding: 0 0 0 16px; list-style: disc; font-size: 12.5px; font-weight: 700; line-height: 1.28; }
      .qpdf-list li { margin: 8px 0; color: #111827; }
      .qpdf-footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #000; font-size: 10.5px; color: #111827; text-align: center; line-height: 1.24; }
      .qpdf-footer__brand { margin-bottom: 2px; font-size: 12px; color: #000; font-weight: 700; }
      .qpdf-footer__row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 1px; }
      .qpdf-footer strong { color: var(--brand-color); }
      .qpdf-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; margin-top: 20px; }
      .qpdf-gallery__img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 12px; border: 1px solid #e5e7eb; background: #f9fafb; }
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

    const renderHeader = () => `
      <div class="qpdf-header">
         <div class="qpdf-brand">
           ${s.logoDataUrl ? `<img class="qpdf-brand__logo" src="${s.logoDataUrl}" />` : `<div class="qpdf-brand__logo" style="background:#222; color:#fff; display:grid; place-items:center; font-weight:900;">BT</div>`}
           <div class="qpdf-brand__text">
             <div class="qpdf-brand__title">${escapeHtml(companyLine)}</div>
             <div class="qpdf-brand__sub"></div>
           </div>
         </div>
         <div class="qpdf-header__date">Fecha: ${escapeHtml(docDate)}</div>
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

    const renderItineraryDayBlock = (d, idx) => `
      <div class="qpdf-day-block">
        <div class="qpdf-day-head">${escapeHtml(d.day || `DÍA ${idx + 1}`)}${d.title ? `: ${escapeHtml(d.title)}` : ""}</div>
        <div class="qpdf-day-row">
          ${d.image ? `<img class="qpdf-day-image" src="${escapeAttr(d.image)}" />` : `<div class="qpdf-day-image"></div>`}
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

            page.list.removeChild(page.list.lastElementChild);
            if (currentChunk.length) chunks.push(currentChunk);
            currentChunk = [];
            page = makeMeasurePage();

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
    const renderGallery = () => {
        if (!Array.isArray(itinerary.galleryImages) || !itinerary.galleryImages.length) return "";
        const imgs = itinerary.galleryImages.slice(0, 6).map(src => `<img class="qpdf-gallery__img" src="${escapeAttr(src)}" />`).join("");
        return `<div class="qpdf-gallery">${imgs}</div>`;
    };
    const renderReserveBox = () => itinerary.ctaLink ? `
      <div class="qpdf-reserve-box qpdf-reserve-box--inline">
        <div class="qpdf-reserve-label">Reservación</div>
        <a class="qpdf-reserve-link qpdf-reserve-link-anchor" href="${escapeAttr(itinerary.ctaLink)}" target="_blank" rel="noopener">Haz clic aquí para reservar</a>
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

    const page1 = `
      <div class="qpdf-page qpdf-page--first">
        <div class="qpdf-page__inner">
          ${renderHeader()}
          <div class="qpdf-rule"></div>
          <div class="qpdf-page__content">
            <div class="qpdf-hero qpdf-hero--center">
              <div class="qpdf-pill">Itinerario de Viaje</div>
              <h1 class="qpdf-title">${escapeHtml(coverMainTitle)}</h1>
              ${showCoverSubtitle ? `<div class="qpdf-title--sub">${escapeHtml(coverSubTitle)}</div>` : ``}

              <div class="qpdf-chips qpdf-chips--center">
                <div class="qpdf-chip">
                  <div class="qpdf-chip__label">Fechas</div>
                  <div class="qpdf-chip__value">${escapeHtml(datesText)}</div>
                </div>
                <div class="qpdf-chip">
                  <div class="qpdf-chip__label">Duración</div>
                  <div class="qpdf-chip__value">${escapeHtml(durationText)}</div>
                </div>
                <div class="qpdf-chip">
                  <div class="qpdf-chip__label">Pasajeros</div>
                  <div class="qpdf-chip__value">${escapeHtml(paxText)}</div>
                </div>
              </div>
              <div class="qpdf-smallnote">*Detalles de hotel y vuelos se entregan al confirmar la reserva.</div>
            </div>

            ${itinerary.coverImage ? `<div style="margin-top:10px;"><img class="qpdf-gallery__img" style="aspect-ratio:16/6; border:1px solid #000;" src="${escapeAttr(itinerary.coverImage)}" /></div>` : ""}

            <div class="qpdf-cards">
              <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">✈️</span><h3>Transporte</h3></div>
                <ul class="qpdf-list">${listFromLines(transportLines.length ? transportLines : ["Información de vuelo por confirmar."])}</ul>
              </div>
              <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">🏨</span><h3>Alojamiento</h3></div>
                <ul class="qpdf-list">${listFromLines(lodgingLines.length ? lodgingLines : (linesFromOverview.length ? linesFromOverview : ["Alojamiento por confirmar."]))}</ul>
              </div>
              <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">🚐</span><h3>Traslados</h3></div>
                <ul class="qpdf-list">${listFromLines(transferLines.length ? transferLines : (fallbackProgram.length ? fallbackProgram : ["Traslados por confirmar."]))}</ul>
              </div>
            </div>
          </div>
          ${renderFooter()}
        </div>
      </div>
    `;

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
                <ul class="qpdf-list">${listFromLines((itinerary.includes || []).length ? itinerary.includes : ["Por confirmar"])}</ul>
              </div>
              <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">❌</span><h3>No Incluye</h3></div>
                <ul class="qpdf-list">${listFromLines((itinerary.excludes || []).length ? itinerary.excludes : ["Por confirmar"])}</ul>
              </div>
              <div class="qpdf-card">
                <div class="qpdf-card__head"><span class="qpdf-icon">📄</span><h3>Condiciones</h3></div>
                <ul class="qpdf-list">${listFromLines((itinerary.terms || []).length ? itinerary.terms : ["Aplican términos y condiciones del operador."])}</ul>
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

    const toFileLabel = (value, fallback) => {
        const raw = (value || fallback).toString().trim();
        return raw.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
    };

    const clientLabel = toFileLabel(itinerary.clientName || itinerary.clientDisplay, "Cliente");
    const destinationLabel = toFileLabel(itinerary.destination || itinerary.title || tripName, "Destino");
    const filename = `Itinerario - ${clientLabel} - ${destinationLabel}.pdf`;

    try {
        if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
            throw new Error("Faltan librerías PDF (jsPDF/html2canvas).");
        }

        const pageEls = Array.from(root.querySelectorAll(".qpdf-page"));
        if (!pageEls.length) throw new Error("No encontré páginas para exportar.");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

        const reserveLinks = [];
        if (itinerary.ctaLink) {
            pageEls.forEach((pageEl, pageIdx) => {
                const anchor = pageEl.querySelector(".qpdf-reserve-link-anchor");
                if (!anchor) return;
                const pageRect = pageEl.getBoundingClientRect();
                const anchorRect = anchor.getBoundingClientRect();
                if (!pageRect.width || !pageRect.height) return;
                const x = ((anchorRect.left - pageRect.left) / pageRect.width) * 210;
                const y = ((anchorRect.top - pageRect.top) / pageRect.height) * 297;
                const w = (anchorRect.width / pageRect.width) * 210;
                const h = (anchorRect.height / pageRect.height) * 297;
                reserveLinks.push({ page: pageIdx + 1, x, y, w, h, url: itinerary.ctaLink });
            });
        }

        for (let i = 0; i < pageEls.length; i++) {
            const canvas = await window.html2canvas(pageEls[i], {
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
        reserveLinks.forEach((ln) => {
            doc.setPage(ln.page);
            doc.link(ln.x, ln.y, ln.w, ln.h, { url: ln.url });
        });

        if (mode === "preview") {
            const blob = doc.output("blob");
            const url = URL.createObjectURL(blob);
            openModal({
                title: "Vista previa de itinerario",
                bodyHtml: `
                  <div class="card" style="padding:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                      <div class="kbd">Revisa el documento antes de descargarlo.</div>
                      <button class="btn primary" id="btnPreviewItiDownload">Descargar PDF</button>
                    </div>
                    <iframe src="${url}" style="width:100%; height:70vh; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:#fff;" title="Vista previa PDF de itinerario"></iframe>
                  </div>
                `,
                onSave: () => {
                    URL.revokeObjectURL(url);
                    closeModal();
                }
            });

            const btn = document.getElementById("btnPreviewItiDownload");
            if (btn) {
                btn.onclick = () => {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                };
            }
        } else {
            doc.save(filename);
        }
    } catch (err) {
        alert(err?.message || "No se pudo generar el PDF.");
    } finally {
        itineraryPdfBusy = false;
    }
}

function splitLines(value = "") {
    return String(value || "").split("\n").map(x => x.trim()).filter(Boolean);
}
