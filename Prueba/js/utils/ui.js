import { state, saveState, refreshTripNames } from "../core/state.js";
import { uid, escapeHtml } from "./helpers.js";

let renderCallback = () => { };

export function setRenderCallback(fn) {
    renderCallback = fn;
}

export function toast(msg, ms = 2400) {
    try {
        const hostId = "toastHost";
        let host = document.getElementById(hostId);
        if (!host) {
            host = document.createElement("div");
            host.id = hostId;
            host.style.position = "fixed";
            host.style.left = "50%";
            host.style.bottom = "18px";
            host.style.transform = "translateX(-50%)";
            host.style.zIndex = "9999";
            host.style.display = "flex";
            host.style.flexDirection = "column";
            host.style.gap = "8px";
            document.body.appendChild(host);
        }
        const el = document.createElement("div");
        el.textContent = msg;
        el.style.background = "rgba(20, 20, 24, .92)";
        el.style.color = "#fff";
        el.style.border = "1px solid rgba(255, 255, 255, .14)";
        el.style.borderRadius = "14px";
        el.style.padding = "10px 12px";
        el.style.boxShadow = "0 10px 30px rgba(0, 0, 0, .35)";
        el.style.fontSize = "13px";
        el.style.maxWidth = "80vw";
        host.appendChild(el);
        setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .25s ease"; }, ms - 250);
        setTimeout(() => { el.remove(); if (host.childElementCount === 0) host.remove(); }, ms);
    } catch (e) {
        console.warn("toast error", e);
    }
}

export function setContent(html) {
    document.getElementById("content").innerHTML = html;
}

export function icon(name) {
    const common = 'width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"';
    switch (name) {
        case 'eye': return `<svg ${common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'edit': return `<svg ${common}><path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'paperclip': return `<svg ${common}><path d="M21.44 11.05 12.7 19.79a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.82-2.82l8.84-8.83" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'download': return `<svg ${common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'copy': return `<svg ${common}><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'trash': return `<svg ${common}><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        case 'dots': return `<svg ${common}><path d="M12 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"/><path d="M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"/><path d="M12 20.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"/></svg>`;
        case 'x': return `<svg ${common}><path d="M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        default: return '';
    }
}

export const modal = {
    overlay: document.getElementById("modalOverlay"),
    title: document.getElementById("modalTitle"),
    body: document.getElementById("modalBody"),
    btnClose: document.getElementById("modalClose"),
    btnCancel: document.getElementById("modalCancel"),
    btnSave: document.getElementById("modalSave"),
    onSave: null,
};

export function initModal() {
    if (modal.btnClose) modal.btnClose.addEventListener("click", closeModal);
    if (modal.btnCancel) modal.btnCancel.addEventListener("click", closeModal);
}

export function openModal({ title, bodyHtml, onSave }) {
    modal.title.textContent = title;
    modal.body.innerHTML = bodyHtml;
    modal.onSave = onSave;
    modal.overlay.classList.remove("hidden");
    modal.btnSave.onclick = async () => { if (modal.onSave) await modal.onSave(); };
}

export function closeModal() {
    modal.overlay.classList.add("hidden");
    modal.body.innerHTML = "";
    modal.onSave = null;
}

// Module Toolbar and Export/Import Logic

export function renderModuleToolbar(scope, leftHtml, rightHtml) {
    const ddId = `dd_${scope}`;
    const inputId = `import_${scope}`;

    const exportHtml = `
    <div class="dropdown">
      <button class="btn ghost" type="button" onclick="toggleDropdown('${ddId}')">Exportar ▾</button>
      <div id="${ddId}" class="dropdown-menu hidden">
        <button class="dropdown-item" type="button" onclick="exportScope('${scope}','pdf')">PDF</button>
        <button class="dropdown-item" type="button" onclick="exportScope('${scope}','xlsx')">Excel</button>
        <button class="dropdown-item" type="button" onclick="exportScope('${scope}','csv')">CSV</button>
        <button class="dropdown-item" type="button" onclick="exportScope('${scope}','json')">JSON</button>
      </div>
    </div>
  `;

    const importHtml = `
    <button class="btn ghost" type="button" title="Importar (JSON/CSV/XLSX)" onclick="triggerImport('${scope}')">Importar</button>
    <input id="${inputId}" type="file" accept="application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden
      onchange="importScopeFile(event,'${scope}')" />
  `;

    return `
    <div class="toolbar">
      <div class="left">${leftHtml || ""}</div>
      <div class="right">
        ${exportHtml}
        ${importHtml}
        ${rightHtml || ""}
      </div>
    </div>
  `;
}

export function toggleDropdown(id) {
    closeAllDropdowns(id);
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden");
}

export function triggerImport(scope) {
    const el = document.getElementById(`import_${scope}`);
    if (!el) { toast("Input de import no encontrado."); return; }
    el.value = "";
    el.click();
}

export function closeAllDropdowns(exceptId) {
    document.querySelectorAll(".dropdown-menu").forEach(m => {
        if (exceptId && m.id === exceptId) return;
        m.classList.add("hidden");
    });
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) closeAllDropdowns();
});

// Scope Accessors

function getScopeArray(scope) {
    if (scope === "clients") return state.clients;
    if (scope === "trips") return state.trips;
    if (scope === "paymentPlans" || scope === "payment-plans") return state.paymentPlans;
    if (scope === "itineraries") return state.itineraries;
    if (scope === "campaigns") return state.campaigns;
    if (scope === "templates") return state.templates;
    return state[scope] || [];
}

function setScopeArray(scope, arr) {
    if (scope === "clients") state.clients = arr;
    else if (scope === "trips") state.trips = arr;
    else if (scope === "paymentPlans" || scope === "payment-plans") state.paymentPlans = arr;
    else if (scope === "itineraries") state.itineraries = arr;
    else if (scope === "campaigns") state.campaigns = arr;
    else if (scope === "templates") state.templates = arr;
    else state[scope] = arr;
}

function scopeLabel(scope) {
    const map = {
        clients: "Clientes",
        trips: "Viajes",
        "payment-plans": "Planes de pago",
        paymentPlans: "Planes de pago",
        itineraries: "Itinerarios",
        campaigns: "Campañas",
        templates: "Plantillas",
    };
    return map[scope] || scope;
}

// Export implementation

export function exportScope(scope, format) {
    closeAllDropdowns();
    const data = getScopeArray(scope).slice();
    if (!data.length) {
        toast(`No hay datos para exportar en ${scopeLabel(scope)}.`);
        return;
    }
    if (format === "json") return downloadJSON(data, `${scopeLabel(scope)}.json`);
    if (format === "csv") return downloadCSV(data, `${scopeLabel(scope)}.csv`);
    if (format === "xlsx") return downloadXLSX(data, `${scopeLabel(scope)}.xlsx`);
    if (format === "pdf") return exportScopePDF(scope, data);
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function flattenRow(obj) {
    const out = {};
    Object.keys(obj || {}).forEach(k => {
        const v = obj[k];
        if (v === null || v === undefined) out[k] = "";
        else if (typeof v === "object") out[k] = JSON.stringify(v);
        else out[k] = String(v);
    });
    return out;
}

function downloadCSV(data, filename) {
    const rows = data.map(flattenRow);
    const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    const esc = (s) => `"${String(s ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.map(esc).join(",")]
        .concat(rows.map(r => headers.map(h => esc(r[h] ?? "")).join(",")))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, filename);
}

function downloadXLSX(data, filename) {
    if (!window.XLSX) {
        toast("No se cargó XLSX (SheetJS). Revisa tu conexión a internet/CDN.");
        return;
    }
    const rows = data.map(flattenRow);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, filename);
}

function exportScopePDF(scope, data) {
    const root = document.getElementById("pdf-root");
    if (!root) {
        toast("No existe #pdf-root (revisa index.html).");
        return;
    }
    if (!window.html2pdf) {
        toast("No se cargó html2pdf. Revisa tu conexión a internet/CDN.");
        return;
    }

    const title = scopeLabel(scope);
    const rows = data.slice(0, 500).map(flattenRow);
    const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r)))).slice(0, 12);
    const bodyRows = rows.map(r => headers.map(h => escapeHtml(r[h] ?? "")));

    root.innerHTML = `
    <div class="pdf-sheet">
      <div class="pdf-head">
        <div class="pdf-brand">${escapeHtml(state.settings.companyName || "Brianessa Travel")}</div>
        <div class="pdf-title">${escapeHtml(title)}</div>
        <div class="pdf-meta">Generado: ${new Date().toLocaleString()}</div>
      </div>
      <div class="pdf-card">
        <table class="pdf-table">
          <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>
            ${bodyRows.map(cols => `<tr>${cols.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="pdf-foot">* Si hay muchos campos, el sistema limita columnas/filas para mantener el PDF liviano.</div>
    </div>
  `;

    const element = root.firstElementChild;
    const filename = `${title.replace(/[^\w\-]+/g, "_")}.pdf`;
    const opt = {
        margin: [18, 18, 18, 18],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: null },
        jsPDF: { unit: "pt", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["css", "legacy"] }
    };

    html2pdf().set(opt).from(element).save().then(() => root.innerHTML = "").catch(() => {
        root.innerHTML = "";
        toast("No pude generar el PDF (html2pdf).");
    });
}

// Import implementation

export function importScopeFile(ev, scope) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const reader = new FileReader();

    const finish = (importRows) => {
        try {
            if (!Array.isArray(importRows)) throw new Error("Formato inválido: se esperaba un arreglo.");
            mergeIntoScope(scope, importRows);
            refreshTripNames();
            saveState();
            renderCallback();
            toast(`Importado en ${scopeLabel(scope)}: ${importRows.length} registro(s).`);
        } catch (err) {
            console.error(err);
            toast("No pude importar: " + (err.message || "Error"));
        } finally {
            ev.target.value = "";
        }
    };

    if (name.endsWith(".json")) {
        reader.onload = () => {
            const data = JSON.parse(reader.result);
            finish(data);
        };
        reader.readAsText(file, "utf-8");
        return;
    }

    if (name.endsWith(".csv")) {
        reader.onload = () => finish(parseCSV(reader.result));
        reader.readAsText(file, "utf-8");
        return;
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        if (!window.XLSX) {
            toast("No se cargó XLSX (SheetJS). Revisa tu conexión a internet/CDN.");
            ev.target.value = "";
            return;
        }
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
            finish(json);
        };
        reader.readAsArrayBuffer(file);
        return;
    }

    toast("Formato no soportado. Usa JSON, CSV o XLSX.");
    ev.target.value = "";
}

function parseCSV(text) {
    const lines = (text || "").split(/\r?\n/).filter(l => l.trim() !== "");
    if (!lines.length) return [];
    const parseLine = (line) => {
        const out = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                else inQ = !inQ;
            } else if (ch === ',' && !inQ) {
                out.push(cur); cur = "";
            } else cur += ch;
        }
        out.push(cur);
        return out.map(s => s.trim());
    };
    const headers = parseLine(lines[0]).map(h => h.replace(/^\uFEFF/, ""));
    return lines.slice(1).map(l => {
        const cols = parseLine(l);
        const obj = {};
        headers.forEach((h, idx) => obj[h] = cols[idx] ?? "");
        return obj;
    });
}

function ensureId(row) {
    if (row.id) return row.id;
    row.id = uid();
    return row.id;
}

function mergeIntoScope(scope, incoming) {
    const existing = getScopeArray(scope).slice();
    const map = new Map(existing.map(r => [r.id, r]));
    incoming.forEach(r => {
        const row = (typeof r === "object" && r) ? r : { value: r };
        ensureId(row);
        if (map.has(row.id)) {
            Object.assign(map.get(row.id), row);
        } else {
            existing.push(row);
        }
    });
    setScopeArray(scope, existing);
}

// Make globally accessible for inline onclick handlers
window.toggleDropdown = toggleDropdown;
window.triggerImport = triggerImport;
window.exportScope = exportScope;
window.importScopeFile = importScopeFile;
