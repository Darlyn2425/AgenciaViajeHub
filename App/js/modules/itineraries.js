import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal } from "../utils/ui.js";
import { escapeHtml, escapeAttr, matchesSearch, uid, parseNum, toMoney, formatDateLongISO, fileToDataUrl } from "../utils/helpers.js";

window.editItinerary = editItinerary;
window.deleteItinerary = deleteItinerary;
window.viewItinerary = viewItinerary;
window.openItineraryModal = openItineraryModal;
window.exportItineraryPDF = exportItineraryPDF;
window.previewItineraryPDF = previewItineraryPDF;
window.loadPortugalDemoItinerary = loadPortugalDemoItinerary;
window.loadMilanMadridDemoItinerary = loadMilanMadridDemoItinerary;

let itineraryPdfBusy = false;

export function renderItineraries(searchTerm = "") {
    const rows = state.itineraries.filter(i => matchesSearch(i, searchTerm)).map(i => `
    <tr>
      <td><strong>${escapeHtml(i.title)}</strong><div class="kbd">${escapeHtml(i.tripName || i.tripDisplay || "")}</div></td>
      <td>${(i.days || []).length}</td>
      <td>${escapeHtml(i.updatedAt || "")}</td>
      <td>
        <button class="btn" onclick="window.viewItinerary('${i.id}')">Ver</button>
        <button class="btn" onclick="window.editItinerary('${i.id}')">Editar</button>
        <button class="btn" onclick="window.previewItineraryPDF('${i.id}')">Vista PDF</button>
        <button class="btn" onclick="window.exportItineraryPDF('${i.id}')">Descargar PDF</button>
        <button class="btn danger" onclick="window.deleteItinerary('${i.id}')">Eliminar</button>
      </td>
    </tr>
  `).join("");

    setContent(`
    <div class="card">
      ${renderModuleToolbar("itineraries",
        `<div><h2 style="margin:0;">Itinerarios</h2><div class="kbd">Modelo simple editable (tipo Milan-Madrid): portada limpia + páginas de días + incluye/no incluye.</div></div>`,
        `<div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn" onclick="window.loadMilanMadridDemoItinerary()">Cargar demo Milan-Madrid</button>
          <button class="btn" onclick="window.loadPortugalDemoItinerary()">Cargar demo Portugal</button>
          <button class="btn primary" onclick="window.openItineraryModal()">+ Nuevo itinerario</button>
        </div>`
    )}
      <hr/>
      <table class="table">
        <thead><tr><th>Itinerario</th><th>Días</th><th>Actualizado</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay itinerarios todavía.</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

export function loadPortugalDemoItinerary() {
    const existing = state.itineraries.find(x => x.id === "iti_portugal_demo");
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
    else state.itineraries.push(payload);

    saveState();
    if (window.render) window.render();
    setTimeout(() => previewItineraryPDF(payload.id), 120);
}

export function loadMilanMadridDemoItinerary() {
    const existing = state.itineraries.find(x => x.id === "iti_milan_madrid_demo");
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
    else state.itineraries.push(payload);

    saveState();
    if (window.render) window.render();
    setTimeout(() => previewItineraryPDF(payload.id), 120);
}

export function openItineraryModal(existing = null) {
    const tripOptions = state.trips.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
    const theme = existing?.theme || {};
    const cover = existing?.cover || {};

    openModal({
        title: existing ? "Editar itinerario" : "Nuevo itinerario",
        bodyHtml: `
      <div class="field"><label>Título</label><input id="iTitle" value="${escapeHtml(existing?.title || "Itinerario de Viaje")}" /></div>

      <div class="grid">
        <div class="field col-6">
          <label>Viaje (opcional)</label>
          <select id="iTrip"><option value="">(Sin seleccionar)</option>${tripOptions}</select>
        </div>
        <div class="field col-6">
          <label>Nombre del viaje (si no usas select)</label>
          <input id="iTripDisplay" value="${escapeHtml(existing?.tripDisplay || "")}" placeholder="Ej: Dubai Experience 2026" />
        </div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Salida (fecha)</label><input id="iStart" type="date" value="${escapeHtml(existing?.startDate || "")}" /></div>
        <div class="field col-6"><label>Llegada (fecha)</label><input id="iEnd" type="date" value="${escapeHtml(existing?.endDate || "")}" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Inversión</label><input id="iPrice" value="${escapeHtml(existing?.price || "")}" placeholder="Ej: 3799" /></div>
        <div class="field col-6"><label>Inversión con extensión (opcional)</label><input id="iPriceExt" value="${escapeHtml(existing?.priceExt || "")}" placeholder="Ej: 4299" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Reserva (texto)</label><input id="iDepositText" value="${escapeHtml(existing?.depositText || "RESERVA SOLO CON $250")}" /></div>
        <div class="field col-6"><label>Link (Regístrate aquí)</label><input id="iLink" value="${escapeHtml(existing?.ctaLink || "")}" placeholder="Pega el link" /></div>
      </div>

      <div class="field"><label>Overview (resumen principal)</label>
        <textarea id="iOverview" placeholder="Ej: A group journey to Dubai...">${escapeHtml(existing?.overview || "")}</textarea>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Aerolínea ida</label><input id="iAirlineOut" value="${escapeHtml(existing?.flightInfo?.airlineOut || "")}" placeholder="Ej: Turkish Airlines" /></div>
        <div class="field col-6"><label>Aerolínea regreso</label><input id="iAirlineBack" value="${escapeHtml(existing?.flightInfo?.airlineBack || "")}" placeholder="Ej: Turkish Airlines" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Ciudades de salida (1 por línea)</label>
          <textarea id="iDepartureCities" placeholder="New York&#10;Miami">${escapeHtml((existing?.flightInfo?.departureCities || []).join("\n"))}</textarea>
        </div>
        <div class="field col-6"><label>Emiratos del tour (1 por línea)</label>
          <textarea id="iEmirates" placeholder="Dubai&#10;Abu Dhabi&#10;Sharjah">${escapeHtml((existing?.emirates || []).join("\n"))}</textarea>
        </div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Incluye (1 por línea)</label>
          <textarea id="iIncludes" placeholder="Ej: Boletos aéreos...">${escapeHtml((existing?.includes || []).join("\n"))}</textarea>
        </div>
        <div class="field col-6"><label>No incluye (1 por línea)</label>
          <textarea id="iExcludes" placeholder="Ej: Seguro de asistencia...">${escapeHtml((existing?.excludes || []).join("\n"))}</textarea>
        </div>
      </div>

      <div class="field"><label>Términos y condiciones (1 por línea)</label>
        <textarea id="iTerms" placeholder="Ej: Pasaporte vigente 6 meses...">${escapeHtml((existing?.terms || []).join("\n"))}</textarea>
      </div>

      <hr/>
      <div class="kbd">Portada editable (más simple que el PDF original, como pediste).</div>

      <div class="grid">
        <div class="field col-4"><label>Texto portada 1</label><input id="iCoverTop" value="${escapeHtml(cover.top || "THE DANCE FAMILY GROUP")}" /></div>
        <div class="field col-4"><label>Texto portada 2</label><input id="iCoverMiddle" value="${escapeHtml(cover.middle || "EXPERIENCE")}" /></div>
        <div class="field col-4"><label>Texto portada 3</label><input id="iCoverBottom" value="${escapeHtml(cover.bottom || "TRAVEL ITINERARY")}" /></div>
      </div>

      <div class="grid">
        <div class="field col-4"><label>Color principal</label><input id="iPrimaryColor" type="color" value="${escapeAttr(theme.primary || "#0b3d91")}" /></div>
        <div class="field col-4"><label>Color secundario</label><input id="iSecondaryColor" type="color" value="${escapeAttr(theme.secondary || "#1d63c7")}" /></div>
        <div class="field col-4"><label>Color acento</label><input id="iAccentColor" type="color" value="${escapeAttr(theme.accent || "#f3c61b")}" /></div>
      </div>

      <div class="field"><label>Imagen portada</label>
        <input id="iCoverImageFile" type="file" accept="image/*" />
        <input id="iCoverImage" type="hidden" value="${escapeAttr(existing?.coverImage || "")}" />
        <div style="margin-top:8px;">
          ${existing?.coverImage ? `<img id="iCoverPreview" src="${escapeAttr(existing.coverImage)}" style="width:100%; max-height:180px; object-fit:cover; border-radius:10px; border:1px solid rgba(0,0,0,.12);"/>` : `<div id="iCoverPreview" class="kbd">Sin imagen seleccionada.</div>`}
        </div>
      </div>

      <div class="field"><label>Galería del itinerario</label>
        <input id="iGalleryFile" type="file" accept="image/*" multiple />
        <div class="kbd">Puedes usar estas imágenes como apoyo general del documento.</div>
        <textarea id="iGallery" placeholder="DataURL por línea (se llena automático al subir imágenes)">${escapeHtml((existing?.galleryImages || []).join("\n"))}</textarea>
      </div>

      <div class="field">
        <label>Fotos por día (sin tocar JSON manual)</label>
        <input id="iDayImagesFile" type="file" accept="image/*" multiple />
        <div class="row" style="margin-top:8px;">
          <button class="btn" id="iApplyDayImages" type="button">Aplicar fotos a días (en orden)</button>
          <span class="kbd">La primera foto se asigna al día 1, la segunda al día 2, etc.</span>
        </div>
      </div>

      <div class="field"><label>Días (JSON simple)</label>
        <textarea id="iDays" placeholder='[{"day":"DAY 1","title":"Arrival in Dubai","time":"8:00 AM","content":"...","meals":"Breakfast","image":"data:image/..."}]'>${escapeHtml(JSON.stringify(existing?.days || [], null, 2))}</textarea>
      </div>

      <div class="row">
        <button class="btn" id="iGenerate">Generar texto itinerario</button>
        <span class="kbd">Mantiene estructura estilo Dubai: overview + flights + day-by-day.</span>
      </div>

      <div class="field"><label>Texto generado</label>
        <textarea id="iText" placeholder="Aquí sale el itinerario...">${escapeHtml(existing?.text || "")}</textarea>
      </div>
    `,
        onSave: () => {
            const tripId = document.getElementById("iTrip").value || "";
            const tripObj = state.trips.find(t => t.id === tripId);

            const title = document.getElementById("iTitle").value.trim() || "Itinerario de Viaje";
            const tripDisplay = document.getElementById("iTripDisplay").value.trim();
            const startDate = document.getElementById("iStart").value || "";
            const endDate = document.getElementById("iEnd").value || "";
            const price = parseNum(document.getElementById("iPrice").value);
            const priceExt = parseNum(document.getElementById("iPriceExt").value);
            const depositText = document.getElementById("iDepositText").value.trim();
            const ctaLink = document.getElementById("iLink").value.trim();
            const overview = document.getElementById("iOverview").value.trim();

            const includes = splitLines(document.getElementById("iIncludes").value);
            const excludes = splitLines(document.getElementById("iExcludes").value);
            const terms = splitLines(document.getElementById("iTerms").value);
            const emirates = splitLines(document.getElementById("iEmirates").value);
            const galleryImages = splitLines(document.getElementById("iGallery").value);
            const departureCities = splitLines(document.getElementById("iDepartureCities").value);

            const coverImage = document.getElementById("iCoverImage").value || "";

            let days = [];
            try { days = JSON.parse(document.getElementById("iDays").value || "[]"); }
            catch { alert("El JSON de días no es válido."); return; }

            const text = document.getElementById("iText").value.trim();

            const payload = {
                id: existing?.id || uid("iti"),
                title,
                tripId,
                tripName: tripObj?.name || "",
                tripDisplay,
                startDate,
                endDate,
                price,
                priceExt,
                depositText,
                ctaLink,
                overview,
                includes,
                excludes,
                terms,
                emirates,
                galleryImages,
                coverImage,
                cover: {
                    top: document.getElementById("iCoverTop").value.trim(),
                    middle: document.getElementById("iCoverMiddle").value.trim(),
                    bottom: document.getElementById("iCoverBottom").value.trim(),
                },
                theme: {
                    primary: document.getElementById("iPrimaryColor").value || "#0b3d91",
                    secondary: document.getElementById("iSecondaryColor").value || "#1d63c7",
                    accent: document.getElementById("iAccentColor").value || "#f3c61b",
                },
                flightInfo: {
                    airlineOut: document.getElementById("iAirlineOut").value.trim(),
                    airlineBack: document.getElementById("iAirlineBack").value.trim(),
                    departureCities,
                },
                days,
                text,
                updatedAt: new Date().toLocaleString(state.settings.locale),
            };

            if (existing) Object.assign(existing, payload);
            else state.itineraries.push(payload);

            saveState();
            closeModal();
            if (window.render) window.render();
        }
    });

    if (existing?.tripId) document.getElementById("iTrip").value = existing.tripId;

    document.getElementById("iGenerate").onclick = () => {
        const s = state.settings;
        const title = document.getElementById("iTitle").value.trim() || "Itinerario de Viaje";
        const tripName = document.getElementById("iTripDisplay").value.trim() || "Viaje grupal";
        const start = document.getElementById("iStart").value || "";
        const end = document.getElementById("iEnd").value || "";
        const price = parseNum(document.getElementById("iPrice").value);
        const priceExt = parseNum(document.getElementById("iPriceExt").value);
        const depositText = document.getElementById("iDepositText").value.trim();
        const link = document.getElementById("iLink").value.trim();
        const overview = document.getElementById("iOverview").value.trim();

        const includes = splitLines(document.getElementById("iIncludes").value);
        const excludes = splitLines(document.getElementById("iExcludes").value);
        const terms = splitLines(document.getElementById("iTerms").value);
        const emirates = splitLines(document.getElementById("iEmirates").value);
        const cities = splitLines(document.getElementById("iDepartureCities").value);

        let days = [];
        try { days = JSON.parse(document.getElementById("iDays").value || "[]"); }
        catch { alert("El JSON de días no es válido."); return; }

        let out = "";
        out += `${tripName}\n${title}\n\n`;
        if (overview) out += `OVERVIEW\n${overview}\n\n`;
        out += `TRAVEL DATES\nSalida: ${formatDateLongISO(start)}\nLlegada: ${formatDateLongISO(end)}\n\n`;
        if (price) out += `INVESTMENT PER PERSON: ${toMoney(price, "USD")}\n`;
        if (priceExt) out += `INVESTMENT WITH EXTENSION: ${toMoney(priceExt, "USD")}\n`;
        if (depositText) out += `${depositText}\n`;
        if (emirates.length) out += `EMIRATES: ${emirates.join(", ")}\n`;
        if (cities.length) out += `DEPARTURE CITIES: ${cities.join(", ")}\n`;
        out += "\n";

        if (includes.length) {
            out += "PACKAGE INCLUDES\n";
            includes.forEach(x => out += `• ${x}\n`);
            out += "\n";
        }
        if (excludes.length) {
            out += "PACKAGE DOES NOT INCLUDE\n";
            excludes.forEach(x => out += `• ${x}\n`);
            out += "\n";
        }
        if (terms.length) {
            out += "TÉRMINOS Y CONDICIONES\n";
            terms.forEach(x => out += `• ${x}\n`);
            out += "\n";
        }

        if (days.length) {
            out += "ITINERARY BY DAY\n\n";
            days.forEach((d, idx) => {
                out += `${d.day || `DAY ${idx + 1}`}${d.title ? `: ${d.title}` : ""}\n`;
                if (d.time) out += `Time: ${d.time}\n`;
                if (d.meals) out += `Meals Included: ${d.meals}\n`;
                if (d.content) out += `${d.content}\n`;
                out += "\n";
            });
        }

        if (link) out += `Register here\n${link}\n\n`;
        out += `${s.companyName}\nTeléfono: ${s.phone} | Correo: ${s.email}\nInstagram: ${s.instagram} | Facebook: ${s.facebook}\nSitio web: ${s.website}\n`;

        document.getElementById("iText").value = out;
    };

    const coverInput = document.getElementById("iCoverImageFile");
    if (coverInput) {
        coverInput.addEventListener("change", async (ev) => {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            const dataUrl = await fileToDataUrl(file, 1800, 2400);
            document.getElementById("iCoverImage").value = dataUrl;
            const preview = document.getElementById("iCoverPreview");
            if (preview) preview.outerHTML = `<img id="iCoverPreview" src="${escapeAttr(dataUrl)}" style="width:100%; max-height:180px; object-fit:cover; border-radius:10px; border:1px solid rgba(0,0,0,.12);"/>`;
        });
    }

    const galleryInput = document.getElementById("iGalleryFile");
    if (galleryInput) {
        galleryInput.addEventListener("change", async (ev) => {
            const files = Array.from(ev.target.files || []);
            if (!files.length) return;
            const urls = await Promise.all(files.map(f => fileToDataUrl(f, 1800, 1800)));
            const area = document.getElementById("iGallery");
            const current = splitLines(area.value);
            area.value = current.concat(urls).join("\n");
        });
    }

    let dayImageUrls = [];
    const dayImagesInput = document.getElementById("iDayImagesFile");
    const applyDayImagesBtn = document.getElementById("iApplyDayImages");

    if (dayImagesInput) {
        dayImagesInput.addEventListener("change", async (ev) => {
            const files = Array.from(ev.target.files || []);
            if (!files.length) {
                dayImageUrls = [];
                return;
            }
            dayImageUrls = await Promise.all(files.map(f => fileToDataUrl(f, 1800, 1800)));
        });
    }

    if (applyDayImagesBtn) {
        applyDayImagesBtn.addEventListener("click", () => {
            if (!dayImageUrls.length) {
                alert("Primero selecciona las fotos por día.");
                return;
            }
            const daysArea = document.getElementById("iDays");
            let days = [];
            try { days = JSON.parse(daysArea.value || "[]"); }
            catch { alert("El JSON de días no es válido."); return; }

            const updated = days.map((d, idx) => ({
                ...d,
                image: dayImageUrls[idx] || d.image || ""
            }));
            daysArea.value = JSON.stringify(updated, null, 2);
            alert("Fotos aplicadas a los días en orden.");
        });
    }
}

export function editItinerary(id) {
    const i = state.itineraries.find(x => x.id === id);
    if (i) openItineraryModal(i);
}

export function deleteItinerary(id) {
    state.itineraries = state.itineraries.filter(x => x.id !== id);
    saveState();
    if (window.render) window.render();
}

export function viewItinerary(id) {
    const i = state.itineraries.find(x => x.id === id);
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

    const itinerary = state.itineraries.find(x => x.id === id);
    const root = document.getElementById("pdf-root");
    if (!itinerary || !root) {
        itineraryPdfBusy = false;
        return;
    }

    const s = state.settings;
    const theme = {
        primary: itinerary.theme?.primary || "#0b3d91",
        secondary: itinerary.theme?.secondary || "#1d63c7",
        accent: itinerary.theme?.accent || "#f3c61b",
    };

    const cover = itinerary.cover || {};
    const tripName = itinerary.tripDisplay || itinerary.tripName || itinerary.title || "Itinerario de Viaje";
    const days = itinerary.days || [];
    const pages = [];

    const header = (subtitle = "ITINERARIO") => `
      <div class="itipdf-header">
        <div class="itipdf-brand">${escapeHtml(s.companyName || "Brianessa Travel")}</div>
        <div class="itipdf-sub">${escapeHtml(subtitle)}</div>
      </div>
    `;

    const footer = () => `
      <div class="itipdf-footer">
        <div>${escapeHtml(s.companyName || "")}</div>
        <div>Teléfono: ${escapeHtml(s.phone || "")} | Correo: ${escapeHtml(s.email || "")}</div>
        <div>Instagram: ${escapeHtml(s.instagram || "")} | Facebook: ${escapeHtml(s.facebook || "")} | ${escapeHtml(s.website || "")}</div>
      </div>
    `;

    const listHtml = (arr = []) => arr.map(x => `<li>${escapeHtml(x)}</li>`).join("");
    const dayBlock = (d, idx) => `
      <article class="itipdf-day">
        <div class="itipdf-day-head">${escapeHtml(d.day || `DÍA ${idx + 1}`)}${d.title ? `: ${escapeHtml(d.title)}` : ""}</div>
        ${d.meals ? `<div class="itipdf-meta"><strong>Comidas incluidas:</strong> ${escapeHtml(d.meals)}</div>` : ""}
        ${d.time ? `<div class="itipdf-meta"><strong>Horario:</strong> ${escapeHtml(d.time)}</div>` : ""}
        <div class="itipdf-day-grid">
          <p class="itipdf-paragraph">${escapeHtml(d.content || "")}</p>
          ${(d.image || "") ? `<img class="itipdf-day-image" src="${escapeAttr(d.image)}" />` : ""}
        </div>
      </article>
    `;

    pages.push(`
      <section class="itipdf-page">
        <div class="itipdf-inner">
          ${header("RESUMEN")}
          ${itinerary.coverImage ? `<img class="itipdf-hero-img" src="${escapeAttr(itinerary.coverImage)}" />` : ""}
          <h1 class="itipdf-title">${escapeHtml(cover.top || itinerary.title || "ITINERARIO")}</h1>
          <h2 class="itipdf-title2">${escapeHtml(cover.middle || tripName)}</h2>
          <div class="itipdf-mini">${escapeHtml(cover.bottom || "")}</div>

          <div class="itipdf-grid-2" style="margin-top:10px;">
            <div class="itipdf-card">
              <h3>Servicios y Precio</h3>
              <div><strong>Desde:</strong> ${itinerary.price ? escapeHtml(toMoney(itinerary.price, "USD")) : "Por definir"}</div>
              ${itinerary.price ? `<div><strong>Total:</strong> ${escapeHtml(toMoney(itinerary.price, "USD"))}</div>` : ""}
              ${itinerary.depositText ? `<div style="margin-top:8px;">${escapeHtml(itinerary.depositText)}</div>` : ""}
            </div>
            <div class="itipdf-card">
              <h3>Fechas</h3>
              <div><strong>Salida:</strong> ${escapeHtml(formatDateLongISO(itinerary.startDate) || "Por definir")}</div>
              <div><strong>Regreso:</strong> ${escapeHtml(formatDateLongISO(itinerary.endDate) || "Por definir")}</div>
              ${itinerary.overview ? `<div style="margin-top:8px;">${escapeHtml(itinerary.overview)}</div>` : ""}
            </div>
          </div>

          ${days.length ? `
            <div class="itipdf-card" style="margin-top:10px;">
              <h3>Inicio del Itinerario</h3>
              ${dayBlock(days[0], 0)}
              ${days[1] ? dayBlock(days[1], 1) : ""}
            </div>
          ` : ""}
          ${footer()}
        </div>
      </section>
    `);

    for (let i = 2; i < days.length; i += 2) {
        const a = days[i];
        const b = days[i + 1];
        pages.push(`
          <section class="itipdf-page">
            <div class="itipdf-inner">
              ${header("ITINERARIO")}
              ${dayBlock(a, i)}
              ${b ? dayBlock(b, i + 1) : ""}
              ${footer()}
            </div>
          </section>
        `);
    }

    pages.push(`
      <section class="itipdf-page">
        <div class="itipdf-inner">
          ${header("INCLUYE / NO INCLUYE")}
          <div class="itipdf-grid-2">
            <div class="itipdf-card">
              <h3>Incluye</h3>
              <ul>${listHtml(itinerary.includes || [])}</ul>
            </div>
            <div class="itipdf-card">
              <h3>No incluye</h3>
              <ul>${listHtml(itinerary.excludes || [])}</ul>
            </div>
          </div>
          ${(itinerary.galleryImages || []).length ? `<div class="itipdf-gallery">${(itinerary.galleryImages || []).slice(0, 4).map(src => `<img src="${escapeAttr(src)}" class="itipdf-gallery-img" />`).join("")}</div>` : ""}
          ${itinerary.ctaLink ? `<div class="itipdf-cta">Reserva tu lugar: ${escapeHtml(itinerary.ctaLink)}</div>` : ""}
          ${footer()}
        </div>
      </section>
    `);

    if ((itinerary.terms || []).length) {
        pages.push(`
          <section class="itipdf-page">
            <div class="itipdf-inner">
              ${header("TÉRMINOS Y CONDICIONES")}
              <div class="itipdf-card">
                <h3>Términos generales</h3>
                <ol class="itipdf-ol">${(itinerary.terms || []).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ol>
              </div>
              ${footer()}
            </div>
          </section>
        `);
    }

    root.innerHTML = `<style>
      .itipdf-wrap, .itipdf-wrap * { box-sizing: border-box; }
      .itipdf-wrap { width: 210mm; margin: 0 auto; font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
      .itipdf-page { width: 210mm; height: 297mm; background: #fff; position: relative; overflow: hidden; break-after: page; page-break-after: always; border: 1px solid #e5e7eb; }
      .itipdf-page:last-child { break-after: auto; page-break-after: auto; }
      .itipdf-inner { height: 100%; padding: 11mm; display: flex; flex-direction: column; gap: 8px; }
      .itipdf-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${theme.primary}; padding-bottom: 6px; }
      .itipdf-brand { font-weight: 800; font-size: 12px; color: ${theme.primary}; }
      .itipdf-sub { font-size: 11px; font-weight: 700; letter-spacing: .05em; color: #334155; text-transform: uppercase; }
      .itipdf-hero-img { width: 100%; max-height: 68mm; object-fit: cover; border-radius: 10px; border: 1px solid #dbe3ef; }
      .itipdf-title { margin: 0; font-size: 40px; line-height: .95; color: ${theme.primary}; font-weight: 900; text-transform: uppercase; }
      .itipdf-title2 { margin: 0; font-size: 30px; line-height: .95; color: ${theme.secondary}; font-weight: 900; text-transform: uppercase; }
      .itipdf-mini { font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: .03em; }
      .itipdf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .itipdf-card { border: 1px solid #dbe3ef; border-radius: 12px; padding: 10px; background: #fff; font-size: 12px; }
      .itipdf-card h3 { margin: 0 0 8px; font-size: 12px; color: ${theme.primary}; text-transform: uppercase; letter-spacing: .04em; }
      .itipdf-card ul { margin: 0; padding-left: 16px; line-height: 1.45; }
      .itipdf-day { padding: 8px 0; border-top: 1px dashed #cbd5e1; }
      .itipdf-day:first-of-type { border-top: none; padding-top: 0; }
      .itipdf-day-head { font-size: 15px; font-weight: 900; color: ${theme.primary}; margin-bottom: 4px; }
      .itipdf-day-grid { display: grid; grid-template-columns: 1fr 110px; gap: 8px; align-items: start; }
      .itipdf-day-image { width: 110px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #dbe3ef; }
      .itipdf-meta { font-size: 11px; margin-bottom: 4px; color: #334155; }
      .itipdf-paragraph { margin: 0; font-size: 12px; line-height: 1.45; white-space: pre-wrap; color: #1e293b; }
      .itipdf-gallery { margin-top: 4px; display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); }
      .itipdf-gallery-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; border: 1px solid #dbe3ef; }
      .itipdf-cta { margin-top: 8px; padding: 10px; border-radius: 10px; border: 1px solid ${theme.accent}; background: #fffdf0; color: #92400e; font-size: 12px; font-weight: 700; }
      .itipdf-ol { margin: 0; padding-left: 18px; line-height: 1.5; font-size: 12px; }
      .itipdf-footer { margin-top: auto; border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 10px; color: #475569; text-align: center; line-height: 1.35; }
    </style><div class="itipdf-wrap">${pages.join("")}</div>`;

    const toFileLabel = (value, fallback) => {
        const raw = (value || fallback).toString().trim();
        return raw.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
    };

    const filename = `Itinerario - ${toFileLabel(tripName, "Viaje")}.pdf`;

    try {
        if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
            throw new Error("Faltan librerías PDF (jsPDF/html2canvas).");
        }

        const pageEls = Array.from(root.querySelectorAll(".itipdf-page"));
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

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
