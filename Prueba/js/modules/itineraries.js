import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal, icon } from "../utils/ui.js";
import { escapeHtml, matchesSearch, uid, parseNum, toMoney, formatDateLongISO } from "../utils/helpers.js";

window.editItinerary = editItinerary;
window.deleteItinerary = deleteItinerary;
window.viewItinerary = viewItinerary;
window.openItineraryModal = openItineraryModal;

export function renderItineraries(searchTerm = "") {
    const rows = state.itineraries.filter(i => matchesSearch(i, searchTerm)).map(i => `
    <tr>
      <td><strong>${escapeHtml(i.title)}</strong><div class="kbd">${escapeHtml(i.tripName || i.tripDisplay || "")}</div></td>
      <td>${(i.days || []).length}</td>
      <td>${escapeHtml(i.updatedAt || "")}</td>
      <td>
        <button class="btn" onclick="window.viewItinerary('${i.id}')">Ver</button>
        <button class="btn" onclick="window.editItinerary('${i.id}')">Editar</button>
        <button class="btn danger" onclick="window.deleteItinerary('${i.id}')">Eliminar</button>
      </td>
    </tr>
  `).join("");

    setContent(`
    <div class="card">
      ${renderModuleToolbar("itineraries",
        `<div><h2 style="margin:0;">Itinerarios</h2><div class="kbd">Resumen + incluye/no incluye + día a día con comidas incluidas.</div></div>`,
        `<button class="btn primary" onclick="window.openItineraryModal()">+ Nuevo itinerario</button>`
    )}
      <hr/>
      <table class="table">
        <thead><tr><th>Itinerario</th><th>Días</th><th>Actualizado</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay itinerarios todavía.</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

export function openItineraryModal(existing = null) {
    const tripOptions = state.trips.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");

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
          <input id="iTripDisplay" value="${escapeHtml(existing?.tripDisplay || "")}" placeholder="Ej: Perú y Machu Picchu" />
        </div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Salida (fecha)</label><input id="iStart" type="date" value="${escapeHtml(existing?.startDate || "")}" /></div>
        <div class="field col-6"><label>Llegada (fecha)</label><input id="iEnd" type="date" value="${escapeHtml(existing?.endDate || "")}" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Inversión</label><input id="iPrice" value="${escapeHtml(existing?.price || "")}" placeholder="Ej: 2869" /></div>
        <div class="field col-6"><label>Inversión con extensión (opcional)</label><input id="iPriceExt" value="${escapeHtml(existing?.priceExt || "")}" placeholder="Ej: 3449" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Reserva (texto)</label><input id="iDepositText" value="${escapeHtml(existing?.depositText || "RESERVA SOLO CON $250")}" /></div>
        <div class="field col-6"><label>Link (Regístrate aquí)</label><input id="iLink" value="${escapeHtml(existing?.ctaLink || "")}" placeholder="Pega el link" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Incluye (1 por línea)</label>
          <textarea id="iIncludes" placeholder="Ej: Boletos aéreos...">${escapeHtml((existing?.includes || []).join("\n"))}</textarea>
        </div>
        <div class="field col-6"><label>No incluye (1 por línea)</label>
          <textarea id="iExcludes" placeholder="Ej: Seguro de asistencia...">${escapeHtml((existing?.excludes || []).join("\n"))}</textarea>
        </div>
      </div>

      <div class="field"><label>Días (JSON simple)</label>
        <textarea id="iDays" placeholder='[{"day":"DÍA 1","title":"LIMA","meals":"Ninguna","content":"..."}]'>${escapeHtml(JSON.stringify(existing?.days || [], null, 2))}</textarea>
      </div>

      <div class="row">
        <button class="btn" id="iGenerate">Generar texto itinerario</button>
        <span class="kbd">Estilo basado en tu PDF de Perú (resumen + día a día). </span>
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

            const includes = document.getElementById("iIncludes").value.split("\n").map(x => x.trim()).filter(Boolean);
            const excludes = document.getElementById("iExcludes").value.split("\n").map(x => x.trim()).filter(Boolean);

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
                includes,
                excludes,
                days,
                text,
                updatedAt: new Date().toLocaleString(state.settings.locale),
            };

            if (existing) Object.assign(existing, payload);
            else state.itineraries.push(payload);

            saveState(); closeModal(); if (window.render) window.render();
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

        const includes = document.getElementById("iIncludes").value.split("\n").map(x => x.trim()).filter(Boolean);
        const excludes = document.getElementById("iExcludes").value.split("\n").map(x => x.trim()).filter(Boolean);

        let days = [];
        try { days = JSON.parse(document.getElementById("iDays").value || "[]"); }
        catch { alert("El JSON de días no es válido."); return; }

        let out = "";
        out += `${tripName}\nViaje grupal\n${title}\n\n`;
        out += `RESUMEN\n`;
        out += `Fecha de viaje:\nSalida: ${formatDateLongISO(start)}\nLlegada: ${formatDateLongISO(end)}\n\n`;
        if (price) out += `INVERSIÓN: ${toMoney(price, "USD")}\n`;
        if (priceExt) out += `INVERSIÓN CON EXTENSIÓN: ${toMoney(priceExt, "USD")}\n`;
        if (depositText) out += `${depositText}\n`;
        out += `PLANES DE PAGO DISPONIBLES\n\n`;

        if (includes.length) {
            out += `EL PAQUETE INCLUYE\n`;
            includes.forEach(x => out += `• ${x}\n`);
            out += `\n`;
        }
        if (excludes.length) {
            out += `EL PAQUETE NO INCLUYE\n`;
            excludes.forEach(x => out += `• ${x}\n`);
            out += `\n`;
        }

        if (days.length) {
            days.forEach((d, idx) => {
                out += `${d.day || `DÍA ${idx + 1}`}${d.title ? `: ${d.title}` : ""}\n`;
                if (d.meals) out += `Comidas Incluidas: ${d.meals}\n`;
                if (d.content) out += `${d.content}\n`;
                out += `\n`;
            });
        }

        if (link) {
            out += `Regístrate aquí\n${link}\n\n`;
        }

        out += `${s.companyName}\nTeléfono: ${s.phone} | Correo: ${s.email}\nInstagram: ${s.instagram} | Facebook: ${s.facebook}\nSitio web: ${s.website}\n`;

        document.getElementById("iText").value = out;
    };
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
        </div>
      </div>
    `,
        onSave: () => closeModal()
    });
    document.getElementById("copyIti").onclick = () => navigator.clipboard.writeText(i.text || "");
}
