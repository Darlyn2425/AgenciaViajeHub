const STORAGE_KEY = "bt_hub_v2";

const state = loadState();

const routes = {
  dashboard: renderDashboard,
  clients: renderClients,
  trips: renderTrips,
  "payment-plans": renderPaymentPlans,
  itineraries: renderItineraries,
  campaigns: renderCampaigns,
  templates: renderTemplates,
  ai: renderAI,
  settings: renderSettings,
};

let currentRoute = "dashboard";
let searchTerm = "";


/* =========================
   Toast (mini) - para mensajes rápidos
   ========================= */
function toast(msg, ms=2400){
  try{
    const hostId = "toastHost";
    let host = document.getElementById(hostId);
    if(!host){
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
    el.style.background = "rgba(20,20,24,.92)";
    el.style.color = "#fff";
    el.style.border = "1px solid rgba(255,255,255,.14)";
    el.style.borderRadius = "14px";
    el.style.padding = "10px 12px";
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
    el.style.fontSize = "13px";
    el.style.maxWidth = "80vw";
    host.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .25s ease"; }, ms-250);
    setTimeout(()=>{ el.remove(); if(host.childElementCount===0) host.remove(); }, ms);
  }catch(e){
    // fallback silencioso
    console.warn("toast error", e);
  }
}

init();

function init(){
  bindSidebar();
  bindTopbar();
  bindExportImportAll();
  tickClock();
  setInterval(tickClock, 1000);
  navigate("dashboard");
  // Cierra menús de acciones al hacer click fuera
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.action-menu')) closeAllPlanMenus();
  });

}

function bindSidebar(){
  document.querySelectorAll(".nav-item").forEach(btn=>{
    btn.addEventListener("click", ()=> navigate(btn.dataset.route));
  });
}

function bindTopbar(){
  document.getElementById("globalSearch").addEventListener("input", (e)=>{
    searchTerm = e.target.value.trim().toLowerCase();
    render();
  });

  document.getElementById("btnNewQuick").addEventListener("click", ()=>{
    if(currentRoute === "payment-plans") openPaymentPlanModal();
    else if(currentRoute === "itineraries") openItineraryModal();
    else if(currentRoute === "clients") openClientModal();
    else if(currentRoute === "trips") openTripModal();
    else openQuickMenu();
  });
}

function bindExportImportAll(){
  const btn = document.getElementById("btnExportAll");
  const input = document.getElementById("fileImportAll");
  if(btn) btn.addEventListener("click", ()=> exportJSON({scope:"all"}));
  if(input) input.addEventListener("change", (e)=> importJSON(e, {scope:"all"}));
}

function tickClock(){
  const el = document.getElementById("clock");
  const d = new Date();
  el.textContent = d.toLocaleString("es-DO", { dateStyle:"medium", timeStyle:"short" });
}

function navigate(route){
  currentRoute = route;
  document.querySelectorAll(".nav-item").forEach(b=> b.classList.toggle("active", b.dataset.route===route));
  render();
}

function render(){
  (routes[currentRoute] || renderDashboard)();
}

/* =========================
   STATE
========================= */
function seedState(){
  return {
    settings: {
      companyName: "Brianessa Travel | Tu agencia de viajes de confianza",
      phone: "+1 (954) 294-9969",
      email: "BrianessaTravel@gmail.com",
      instagram: "@brianessa",
      facebook: "Brianessa Travel",
      website: "www.brianessatravelboutique.com",
      cardFeePct: 3.5, // como tu formulario original
      locale: "es-DO",
      currencyDefault: "USD"
    },
    clients: [],
    trips: [],
    paymentPlans: [],
    itineraries: [],
    campaigns: [],
    templates: {
      paymentText: [],
      sms: [],
      emailHtml: [],
      disclaimers: [],
    }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return seedState();
    const parsed = JSON.parse(raw);
    return { ...seedState(), ...parsed, settings: { ...seedState().settings, ...(parsed.settings||{}) } };
  }catch{
    return seedState();
  }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function uid(prefix="id"){ return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`; }
function matchesSearch(obj){
  if(!searchTerm) return true;
  return JSON.stringify(obj).toLowerCase().includes(searchTerm);
}

/* =========================
   HELPERS
========================= */
function setContent(html){ document.getElementById("content").innerHTML = html; }
function escapeHtml(s=""){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================
   ICONS (inline SVG)
========================= */
function icon(name){
  const common = 'width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"';
  switch(name){
    case 'eye':
      return `<svg ${common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'edit':
      return `<svg ${common}><path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'paperclip':
      return `<svg ${common}><path d="M21.44 11.05 12.7 19.79a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.82-2.82l8.84-8.83" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'download':
      return `<svg ${common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'trash':
      return `<svg ${common}><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'dots':
      return `<svg ${common}><path d="M12 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"/><path d="M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"/><path d="M12 20.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"/></svg>`;
    case 'x':
      return `<svg ${common}><path d="M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    default:
      return '';
  }
}

function escapeAttr(s=""){
  // Para atributos HTML (href, etc.). No permite comillas ni caracteres peligrosos.
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","")
    .replaceAll(">","")
    .replaceAll('"',"")
    .replaceAll("'","");
}
function toMoney(n, currency){
  const v = Number(n || 0);
  const c = currency || state.settings.currencyDefault;
  return new Intl.NumberFormat(state.settings.locale, { style:"currency", currency: c }).format(v);
}
function round2(n){ return Math.round((Number(n||0) + Number.EPSILON) * 100) / 100; }
function parseNum(v){ return Number(String(v||"").replace(/[^0-9.-]/g,"")) || 0; }

function formatDateLongISO(iso){
  if(!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(state.settings.locale, { day:"numeric", month:"long", year:"numeric" });
}

function ordinalPago(i){
  const n = i + 1;
  if(n === 1) return "1er";
  if(n === 2) return "2do";
  if(n === 3) return "3er";
  if(n === 4) return "4to";
  if(n === 5) return "5to";
  if(n === 6) return "6to";
  if(n === 7) return "7mo";
  if(n === 8) return "8vo";
  if(n === 9) return "9no";
  return `${n}°`;
}

function buildScheduleDates({startISO, endISO, frequency}){
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  const dates = [];

  if(!startISO || !endISO || isNaN(start) || isNaN(end) || start > end) return dates;

  const daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate(); // m0: 0-11

  if(frequency === "Mensual"){
    // Mantener el mismo día del mes (ej. 30). Si el mes no lo tiene, usa el último día del mes.
    const targetDay = start.getDate();
    let y = start.getFullYear();
    let m0 = start.getMonth();

    while(true){
      const dim = daysInMonth(y, m0);
      const day = Math.min(targetDay, dim);
      const cur = new Date(y, m0, day);

      if(cur < start){
        m0 += 1;
        if(m0 > 11){ m0 = 0; y += 1; }
        continue;
      }
      if(cur > end) break;

      dates.push(cur);

      m0 += 1;
      if(m0 > 11){ m0 = 0; y += 1; }
    }
  }else{
    // Quincenal: cada 15 días
    const cur = new Date(start);
    while(cur <= end){
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 15);
    }
  }

  return dates.map(d => d.toISOString().slice(0,10));
}

function splitInstallments(total, n){
  const base = Math.floor((total / n) * 100) / 100;
  const arr = Array.from({length:n}, ()=> base);
  const sumBase = round2(base * n);
  const diff = round2(total - sumBase);
  arr[n-1] = round2(arr[n-1] + diff); // ajusta última cuota para cerrar exacto
  return arr;
}

/* =========================
   MODAL
========================= */
const modal = {
  overlay: document.getElementById("modalOverlay"),
  title: document.getElementById("modalTitle"),
  body: document.getElementById("modalBody"),
  btnClose: document.getElementById("modalClose"),
  btnCancel: document.getElementById("modalCancel"),
  btnSave: document.getElementById("modalSave"),
  onSave: null,
};
modal.btnClose.addEventListener("click", closeModal);
modal.btnCancel.addEventListener("click", closeModal);

function openModal({title, bodyHtml, onSave}){
  modal.title.textContent = title;
  modal.body.innerHTML = bodyHtml;
  modal.onSave = onSave;
  modal.overlay.classList.remove("hidden");
  modal.btnSave.onclick = async ()=> { if(modal.onSave) await modal.onSave(); };
}
function closeModal(){
  modal.overlay.classList.add("hidden");
  modal.body.innerHTML = "";
  modal.onSave = null;
}

/* =========================
   MODULE TOOLBAR
   (El usuario pidió quitar Exportar/Importar por módulo)
========================= */
function renderModuleToolbar(scope, leftHtml, rightHtml){
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
      <div class="left">${leftHtml||""}</div>
      <div class="right">
        ${exportHtml}
        ${importHtml}
        ${rightHtml||""}
      </div>
    </div>
  `;
}



/* =========================
   EXPORT/IMPORT POR MÓDULO
========================= */
function toggleDropdown(id){
  closeAllDropdowns(id);
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.toggle("hidden");
}

function triggerImport(scope){
  const el = document.getElementById(`import_${scope}`);
  if(!el){ toast("Input de import no encontrado."); return; }
  el.value = ""; // reset
  el.click();
}
window.triggerImport = triggerImport;

function closeAllDropdowns(exceptId){
  document.querySelectorAll(".dropdown-menu").forEach(m=>{
    if(exceptId && m.id === exceptId) return;
    m.classList.add("hidden");
  });
}
document.addEventListener("click", (e)=>{
  // Cierra si haces click fuera de dropdown
  if(!e.target.closest(".dropdown")) closeAllDropdowns();
});

function getScopeArray(scope){
  if(scope === "clients") return state.clients;
  if(scope === "trips") return state.trips;
  if(scope === "paymentPlans" || scope === "payment-plans") return state.paymentPlans;
  if(scope === "itineraries") return state.itineraries;
  if(scope === "campaigns") return state.campaigns;
  if(scope === "templates") return state.templates;
  // fallback: intenta por nombre directo
  return state[scope] || [];
}

function setScopeArray(scope, arr){
  if(scope === "clients") state.clients = arr;
  else if(scope === "trips") state.trips = arr;
  else if(scope === "paymentPlans" || scope === "payment-plans") state.paymentPlans = arr;
  else if(scope === "itineraries") state.itineraries = arr;
  else if(scope === "campaigns") state.campaigns = arr;
  else if(scope === "templates") state.templates = arr;
  else state[scope] = arr;
}

function scopeLabel(scope){
  const map = {
    clients:"Clientes",
    trips:"Viajes",
    "payment-plans":"Planes de pago",
    paymentPlans:"Planes de pago",
    itineraries:"Itinerarios",
    campaigns:"Campañas",
    templates:"Plantillas",
  };
  return map[scope] || scope;
}

function exportScope(scope, format){
  closeAllDropdowns();
  const data = getScopeArray(scope).slice();
  if(!data.length){
    toast(`No hay datos para exportar en ${scopeLabel(scope)}.`);
    return;
  }
  if(format === "json") return downloadJSON(data, `${scopeLabel(scope)}.json`);
  if(format === "csv") return downloadCSV(data, `${scopeLabel(scope)}.csv`);
  if(format === "xlsx") return downloadXLSX(data, `${scopeLabel(scope)}.xlsx`);
  if(format === "pdf") return exportScopePDF(scope, data);
}

function downloadJSON(data, filename){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json;charset=utf-8"});
  downloadBlob(blob, filename);
}

function flattenRow(obj){
  const out = {};
  Object.keys(obj||{}).forEach(k=>{
    const v = obj[k];
    if(v === null || v === undefined) out[k] = "";
    else if(typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = String(v);
  });
  return out;
}

function downloadCSV(data, filename){
  const rows = data.map(flattenRow);
  const headers = Array.from(new Set(rows.flatMap(r=>Object.keys(r))));
  const esc = (s)=> `"${String(s??"").replaceAll('"','""')}"`;
  const csv = [headers.map(esc).join(",")]
    .concat(rows.map(r=> headers.map(h=> esc(r[h]??"")).join(",")))
    .join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  downloadBlob(blob, filename);
}

function downloadXLSX(data, filename){
  if(!window.XLSX){
    toast("No se cargó XLSX (SheetJS). Revisa tu conexión a internet/CDN.");
    return;
  }
  const rows = data.map(flattenRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  const wbout = XLSX.write(wb, {bookType:"xlsx", type:"array"});
  const blob = new Blob([wbout], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  downloadBlob(blob, filename);
}

function exportScopePDF(scope, data){
  // PDF por módulo: tabla simple con html2pdf (mismo look)
  const root = document.getElementById("pdf-root");
  if(!root){
    toast("No existe #pdf-root (revisa index.html).");
    return;
  }
  if(!window.html2pdf){
    toast("No se cargó html2pdf. Revisa tu conexión a internet/CDN.");
    return;
  }

  const title = scopeLabel(scope);
  const rows = data.slice(0, 500).map(flattenRow); // evita PDFs gigantes
  const headers = Array.from(new Set(rows.flatMap(r=>Object.keys(r)))).slice(0, 12); // máximo 12 columnas
  const bodyRows = rows.map(r=> headers.map(h=> escapeHtml(r[h]??"")));

  root.innerHTML = `
    <div class="pdf-sheet">
      <div class="pdf-head">
        <div class="pdf-brand">${escapeHtml(state.settings.companyName || "Brianessa Travel")}</div>
        <div class="pdf-title">${escapeHtml(title)}</div>
        <div class="pdf-meta">Generado: ${new Date().toLocaleString()}</div>
      </div>
      <div class="pdf-card">
        <table class="pdf-table">
          <thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>
            ${bodyRows.map(cols=>`<tr>${cols.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="pdf-foot">* Si hay muchos campos, el sistema limita columnas/filas para mantener el PDF liviano.</div>
    </div>
  `;

  const element = root.firstElementChild;
  const filename = `${title.replace(/[^\w\-]+/g,"_")}.pdf`;
  const opt = {
    margin:       [18, 18, 18, 18],
    filename:     filename,
    image:        { type:"jpeg", quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: null },
    jsPDF:        { unit:"pt", format:"a4", orientation:"landscape" },
    pagebreak:    { mode: ["css", "legacy"] }
  };

  html2pdf().set(opt).from(element).save().then(()=> root.innerHTML="").catch(()=>{
    root.innerHTML="";
    toast("No pude generar el PDF (html2pdf).");
  });
}

function importScopeFile(ev, scope){
  const file = ev.target.files && ev.target.files[0];
  if(!file) return;

  const name = file.name.toLowerCase();
  const reader = new FileReader();

  const finish = (importRows)=>{
    try{
      if(!Array.isArray(importRows)) throw new Error("Formato inválido: se esperaba un arreglo.");
      mergeIntoScope(scope, importRows);
      saveState();
      renderCurrentRoute();
      toast(`Importado en ${scopeLabel(scope)}: ${importRows.length} registro(s).`);
    }catch(err){
      console.error(err);
      toast("No pude importar: " + (err.message||"Error"));
    }finally{
      // resetea input para permitir re-importar el mismo archivo
      ev.target.value = "";
    }
  };

  if(name.endsWith(".json")){
    reader.onload = ()=> {
      const data = JSON.parse(reader.result);
      finish(data);
    };
    reader.readAsText(file, "utf-8");
    return;
  }

  if(name.endsWith(".csv")){
    reader.onload = ()=> finish(parseCSV(reader.result));
    reader.readAsText(file, "utf-8");
    return;
  }

  if(name.endsWith(".xlsx") || name.endsWith(".xls")){
    if(!window.XLSX){
      toast("No se cargó XLSX (SheetJS). Revisa tu conexión a internet/CDN.");
      ev.target.value = "";
      return;
    }
    reader.onload = (e)=>{
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:"array"});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, {defval:""});
      finish(json);
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  toast("Formato no soportado. Usa JSON, CSV o XLSX.");
  ev.target.value = "";
}

function parseCSV(text){
  const lines = (text||"").split(/\r?\n/).filter(l=>l.trim()!=="");
  if(!lines.length) return [];
  const parseLine = (line)=>{
    const out = [];
    let cur = "", inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch === '"' ){
        if(inQ && line[i+1] === '"'){ cur+='"'; i++; }
        else inQ = !inQ;
      } else if(ch === ',' && !inQ){
        out.push(cur); cur="";
      } else cur+=ch;
    }
    out.push(cur);
    return out.map(s=>s.trim());
  };
  const headers = parseLine(lines[0]).map(h=>h.replace(/^\uFEFF/,""));
  return lines.slice(1).map(l=>{
    const cols=parseLine(l);
    const obj={};
    headers.forEach((h,idx)=> obj[h]=cols[idx] ?? "");
    return obj;
  });
}

function ensureId(row){
  if(row.id) return row.id;
  row.id = cryptoId();
  return row.id;
}

function mergeIntoScope(scope, incoming){
  const existing = getScopeArray(scope).slice();
  const map = new Map(existing.map(r=>[r.id, r]));
  incoming.forEach(r=>{
    const row = (typeof r === "object" && r) ? r : {value:r};
    ensureId(row);
    if(map.has(row.id)){
      Object.assign(map.get(row.id), row);
    }else{
      existing.push(row);
    }
  });
  setScopeArray(scope, existing);
}

function openImportModal(scope){
  openModal({
    title:`Importar ${scope}`,
    bodyHtml: `
      <div class="card">
        <p class="kbd">Sube un JSON exportado desde este mismo sistema. Se mezclará con lo existente.</p>
        <label class="btn file full" style="margin-top:10px;">
          Seleccionar archivo JSON
          <input id="fileImportScoped" type="file" accept="application/json" hidden />
        </label>
      </div>
    `,
    onSave: ()=> closeModal()
  });

  const input = document.getElementById("fileImportScoped");
  input.addEventListener("change", (e)=> importJSON(e, {scope}));
}

/* =========================
   DASHBOARD
========================= */
function renderDashboard(){
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
            <button class="btn primary" onclick="openPaymentPlanModal()">+ Plan de pago</button>
            <button class="btn primary" onclick="openItineraryModal()">+ Itinerario</button>
          </div>
        </div>
      </div>
    </div>
  `);
}

/* =========================
   CLIENTS
========================= */
function renderClients(){
  const rows = state.clients.filter(matchesSearch).map(c=>`
    <tr>
      <td><strong>${escapeHtml(c.name)}</strong><div class="kbd">${escapeHtml(c.tripName||"")}</div></td>
      <td>${escapeHtml(c.phone||"")}</td>
      <td>${escapeHtml(c.email||"")}</td>
      <td>
        <button class="btn" onclick="editClient('${c.id}')">Editar</button>
        <button class="btn danger" onclick="deleteClient('${c.id}')">Eliminar</button>
      </td>
    </tr>
  `).join("");

  setContent(`
    <div class="card">
      ${renderModuleToolbar("clients",
        `<div><h2 style="margin:0;">Clientes</h2><div class="kbd">Base para asociar pagos/itinerarios.</div></div>`,
        `<button class="btn primary" onclick="openClientModal()">+ Nuevo cliente</button>`
      )}
      <hr/>
      <table class="table">
        <thead><tr><th>Cliente</th><th>Tel</th><th>Email</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay clientes todavía.</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

function openClientModal(existing=null){
  const tripOptions = state.trips.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  openModal({
    title: existing ? "Editar cliente" : "Nuevo cliente",
    bodyHtml: `
      <div class="field"><label>Nombre</label><input id="cName" value="${escapeHtml(existing?.name||"")}" /></div>
      <div class="field"><label>Teléfono</label><input id="cPhone" value="${escapeHtml(existing?.phone||"")}" /></div>
      <div class="field"><label>Email</label><input id="cEmail" value="${escapeHtml(existing?.email||"")}" /></div>
      <div class="field">
        <label>Viaje</label>
        <select id="cTrip">
          <option value="">(Sin asignar)</option>
          ${tripOptions}
        </select>
      </div>
    `,
    onSave: ()=>{
      const name = document.getElementById("cName").value.trim();
      if(!name) return;
      const phone = document.getElementById("cPhone").value.trim();
      const email = document.getElementById("cEmail").value.trim();
      const tripId = document.getElementById("cTrip").value || "";
      const trip = state.trips.find(t=>t.id===tripId);

      if(existing){
        existing.name=name; existing.phone=phone; existing.email=email;
        existing.tripId=tripId; existing.tripName=trip?.name||"";
      }else{
        state.clients.push({ id: uid("cli"), name, phone, email, tripId, tripName: trip?.name||"" });
      }
      saveState(); closeModal(); render();
    }
  });
  if(existing?.tripId) document.getElementById("cTrip").value = existing.tripId;
}
function editClient(id){ const c = state.clients.find(x=>x.id===id); if(c) openClientModal(c); }
function deleteClient(id){ state.clients = state.clients.filter(x=>x.id!==id); saveState(); render(); }

/* =========================
   TRIPS
========================= */
function renderTrips(){
  const rows = state.trips.filter(matchesSearch).map(t=>`
    <tr>
      <td><strong>${escapeHtml(t.name)}</strong><div class="kbd">${escapeHtml(t.destination||"")}</div></td>
      <td>${escapeHtml(t.startDate||"")}</td>
      <td>${escapeHtml(t.status||"Activo")}</td>
      <td>
        <button class="btn" onclick="editTrip('${t.id}')">Editar</button>
        <button class="btn danger" onclick="deleteTrip('${t.id}')">Eliminar</button>
      </td>
    </tr>
  `).join("");

  setContent(`
    <div class="card">
      ${renderModuleToolbar("trips",
        `<div><h2 style="margin:0;">Viajes / Grupos</h2><div class="kbd">Crea el viaje y asocia todo.</div></div>`,
        `<button class="btn primary" onclick="openTripModal()">+ Nuevo viaje</button>`
      )}
      <hr/>
      <table class="table">
        <thead><tr><th>Viaje</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay viajes todavía.</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

function openTripModal(existing=null){
  openModal({
    title: existing ? "Editar viaje" : "Nuevo viaje",
    bodyHtml: `
      <div class="field"><label>Nombre del viaje</label><input id="tName" value="${escapeHtml(existing?.name||"")}" /></div>
      <div class="field"><label>Destino</label><input id="tDest" value="${escapeHtml(existing?.destination||"")}" /></div>
      <div class="field"><label>Fecha inicio</label><input id="tStart" type="date" value="${escapeHtml(existing?.startDate||"")}" /></div>
      <div class="field"><label>Estado</label>
        <select id="tStatus"><option>Activo</option><option>En venta</option><option>Cerrado</option></select>
      </div>
    `,
    onSave: ()=>{
      const name = document.getElementById("tName").value.trim();
      if(!name) return;
      const destination = document.getElementById("tDest").value.trim();
      const startDate = document.getElementById("tStart").value || "";
      const status = document.getElementById("tStatus").value;

      if(existing) Object.assign(existing, {name,destination,startDate,status});
      else state.trips.push({ id: uid("trip"), name, destination, startDate, status });

      refreshTripNames();
      saveState(); closeModal(); render();
    }
  });
  if(existing?.status) document.getElementById("tStatus").value = existing.status;
}
function editTrip(id){ const t = state.trips.find(x=>x.id===id); if(t) openTripModal(t); }
function deleteTrip(id){ state.trips = state.trips.filter(x=>x.id!==id); refreshTripNames(); saveState(); render(); }

function refreshTripNames(){
  const map = new Map(state.trips.map(t=>[t.id, t.name]));
  state.clients.forEach(c=> c.tripName = map.get(c.tripId) || "");
  state.paymentPlans.forEach(p=> p.tripName = map.get(p.tripId) || "");
  state.itineraries.forEach(i=> i.tripName = map.get(i.tripId) || "");
}

/* =========================
   PAYMENT PLANS (FORMATO PDF DUBAI)
========================= */
function renderPaymentPlans(){
  const rows = state.paymentPlans.filter(matchesSearch).map(p=>{
    const hasPdf = !!p.attachmentPdf;
    const pdfBadge = hasPdf ? `<span class="badge pdf" title="Tiene PDF adjunto">PDF</span>` : ``;

    const menuItems = `
      <button class="menu-item" onclick="exportPaymentPlanPDF('${p.id}')">
        <span class="mi-ic">${icon('download')}</span>
        <span class="mi-tx">Descargar plan (PDF)</span>
      </button>
  
      <button class="menu-item" onclick="attachPaymentPlan('${p.id}')">
        <span class="mi-ic">${icon('paperclip')}</span>
        <span class="mi-tx">Adjuntar PDF</span>
      </button>

  ${hasPdf ? `
    <div class="menu-sep"></div>
    <button class="menu-item" onclick="previewPaymentPlanAttachment('${p.id}')">
      <span class="mi-ic">${icon('eye')}</span>
      <span class="mi-tx">Ver PDF adjunto</span>
    </button>
    <button class="menu-item" onclick="downloadPaymentPlanAttachment('${p.id}')">
      <span class="mi-ic">${icon('download')}</span>
      <span class="mi-tx">Descargar PDF adjunto</span>
    </button>
    <button class="menu-item danger" onclick="removePaymentPlanAttachment('${p.id}')">
      <span class="mi-ic">${icon('x')}</span>
      <span class="mi-tx">Quitar PDF adjunto</span>
    </button>
  ` : ``}

  <div class="menu-sep"></div>
  <button class="menu-item danger" onclick="deletePaymentPlan('${p.id}')">
    <span class="mi-ic">${icon('trash')}</span>
    <span class="mi-tx">Eliminar plan</span>
  </button>
`;

    return `
      <tr>
        <td>
          <div class="plan-cell">
            <div class="plan-main">
              <strong>${escapeHtml(p.clientName || p.clientDisplay || "Plan")}</strong>
              ${pdfBadge}
            </div>
            <div class="kbd">${escapeHtml(p.tripName||p.tripDisplay||"")}</div>
          </div>
        </td>
        <td>${escapeHtml(p.currency||state.settings.currencyDefault)}</td>
        <td>${escapeHtml(p.startDate||"")}</td>
        <td>
          <div class="actions compact">
            <button class="icon-btn" title="Ver" aria-label="Ver" onclick="viewPaymentPlan('${p.id}')">${icon('eye')}</button>
            <button class="icon-btn" title="Editar" aria-label="Editar" onclick="editPaymentPlan('${p.id}')">${icon('edit')}</button>

            <div class="action-menu" data-menu="${p.id}">
              <button class="icon-btn" title="Más acciones" aria-label="Más acciones" onclick="togglePlanMenu(event,'${p.id}')">${icon('dots')}</button>
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
        `<button class="btn primary" onclick="openPaymentPlanModal()">+ Nuevo plan</button>`
      )}
      <hr/>
      <table class="table">
        <thead><tr><th>Plan</th><th>Moneda</th><th>Inicio</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay planes todavía.</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

function closeAllPlanMenus(){
  document.querySelectorAll('[id^="plan-menu-"]').forEach(el=>{ el.hidden = true; });
}

function togglePlanMenu(ev, id){
  ev.preventDefault();
  ev.stopPropagation();
  const el = document.getElementById(`plan-menu-${id}`);
  if(!el) return;
  const willOpen = el.hidden;
  closeAllPlanMenus();
  el.hidden = !willOpen;
}

function openPaymentPlanModal(existing=null){
  const clientOptions = state.clients.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  const tripOptions = state.trips.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");

  openModal({
    title: existing ? "Editar plan de pago" : "Nuevo plan de pago",
    bodyHtml: `
      <div class="grid">
        <div class="field col-6">
          <label>Cliente (opcional si no está creado)</label>
          <select id="pClient"><option value="">(Sin seleccionar)</option>${clientOptions}</select>
        </div>
        <div class="field col-6">
          <label>Nombre del cliente (si no usas el select)</label>
          <input id="pClientDisplay" value="${escapeHtml(existing?.clientDisplay||"")}" placeholder="Ej: Diana Marquez" />
        </div>
      </div>

      <div class="grid">
        <div class="field col-6">
          <label>Viaje (opcional si no está creado)</label>
          <select id="pTrip"><option value="">(Sin seleccionar)</option>${tripOptions}</select>
        </div>
        <div class="field col-6">
          <label>Nombre del viaje (si no usas el select)</label>
          <input id="pTripDisplay" value="${escapeHtml(existing?.tripDisplay||"")}" placeholder="Ej: Dubai con Richard Santos (Escala Dubai)" />
        </div>
      </div>

      <div class="field">
        <label>Mensaje adicional (opcional)</label>
        <input id="pExtra" value="${escapeHtml(existing?.extra||"")}" placeholder="Ej: con Richard Santos (ESCALA DUBAI)" />
      </div>

      <div class="grid">
        <div class="field col-4">
          <label>Moneda</label>
          <select id="pCurrency">
            <option value="USD">USD</option>
            <option value="DOP">DOP</option>
          </select>
        </div>
        <div class="field col-4"><label>Monto total</label><input id="pTotal" value="${escapeHtml(existing?.total||"")}" placeholder="Ej: 3797" /></div>
        <div class="field col-4"><label>Descuento</label><input id="pDiscount" value="${escapeHtml(existing?.discount||"0")}" placeholder="Ej: 300" /></div>
      </div>

      <div class="grid">
        <div class="field col-4"><label>Reserva pagada</label><input id="pDeposit" value="${escapeHtml(existing?.deposit||"0")}" placeholder="Ej: 250" /></div>
        <div class="field col-4">
          <label>Frecuencia</label>
          <select id="pFreq"><option>Mensual</option><option>Quincenal</option></select>
        </div>
        <div class="field col-4">
          <label>Forma de pago</label>
          <select id="pMethod"><option>Transferencia</option><option>Tarjeta</option></select>
        </div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Fecha inicio</label><input id="pStart" type="date" value="${escapeHtml(existing?.startDate||"")}" /></div>
        <div class="field col-6"><label>Fecha fin</label><input id="pEnd" type="date" value="${escapeHtml(existing?.endDate||"")}" /></div>
      </div>

      <div class="field">
        <label>Link de pago</label>
        <input id="pLink" value="${escapeHtml(existing?.paymentLink||"")}" placeholder="Pega tu link aquí" />
      </div>

      <div class="row">
        <button class="btn" id="pGenerate">Generar texto (formato PDF)</button>
        <span class="kbd">Usa el estilo de tu PDF de Dubái.</span>
      </div>

      <div class="field">
        <label>Texto generado</label>
        <textarea id="pText" placeholder="Aquí sale el documento...">${escapeHtml(existing?.text||"")}</textarea>
      </div>
    `,
    onSave: ()=>{
      const clientId = document.getElementById("pClient").value || "";
      const tripId = document.getElementById("pTrip").value || "";
      const clientObj = state.clients.find(c=>c.id===clientId);
      const tripObj = state.trips.find(t=>t.id===tripId);

      const clientDisplay = document.getElementById("pClientDisplay").value.trim();
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

      const payload = {
        id: existing?.id || uid("pay"),
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

      if(existing) Object.assign(existing, payload);
      else state.paymentPlans.push(payload);

      saveState();
      closeModal();
      render();
    }
  });

  if(existing){
    if(existing.clientId) document.getElementById("pClient").value = existing.clientId;
    if(existing.tripId) document.getElementById("pTrip").value = existing.tripId;
    if(existing.currency) document.getElementById("pCurrency").value = existing.currency;
    if(existing.freq) document.getElementById("pFreq").value = existing.freq;
    if(existing.method) document.getElementById("pMethod").value = existing.method;
  }

  document.getElementById("pGenerate").onclick = ()=>{
    const s = state.settings;
    const clientSel = document.getElementById("pClient").value || "";
    const tripSel = document.getElementById("pTrip").value || "";
    const clientObj = state.clients.find(c=>c.id===clientSel);
    const tripObj = state.trips.find(t=>t.id===tripSel);

    const cliente = (clientObj?.name || document.getElementById("pClientDisplay").value.trim() || "Cliente");
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

    const dates = buildScheduleDates({startISO, endISO, frequency: freq});
    const cuotas = dates.length || 0;
    const montos = cuotas ? splitInstallments(restante, cuotas) : [];
    const montoCuotaBase = cuotas ? montos[0] : 0;

    // tarjeta: aplica % configurable (default 3.5)
    const feePct = Number(s.cardFeePct || 0);
    const montoCuotaTarjeta = round2(montoCuotaBase * (1 + (feePct/100)));

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

    // Importante: tu PDF tiene “Nota Importante” cuando es tarjeta. :contentReference[oaicite:6]{index=6}
    out += `• Fechas de Pago:\n`;
    dates.forEach((d, i)=>{
      out += `o ${ordinalPago(i)} pago: ${formatDateLongISO(d)}\n`;
    });

    out += `\n👉 Realiza tus pagos aquí\n${link || "(pendiente de link)"}\n\n`;

    if(method === "Tarjeta"){
      out += `Nota Importante\n`;
      out += `Costo Adicional: El monto por cuota es de ${toMoney(montoCuotaTarjeta, currency)} debido a un cargo adicional por el uso de tarjeta de crédito/débito. Este cargo cubre los costos de procesamiento y es una tarifa estándar para pagos con tarjeta.\n`;
      out += `Fechas específicas: Las fechas indicadas son las programadas para sus pagos según la modalidad seleccionada. Si necesita realizar algún ajuste, contáctenos a la brevedad.\n`;
      out += `Atención personalizada: Nuestro equipo está a su disposición para aclarar cualquier duda o atender cualquier necesidad adicional.\n`;
    }

    document.getElementById("pText").value = out;
  };
}



// =========================
// EXPORTAR: PLAN DE PAGO (PDF por fila)
// =========================
function parsePaymentPlanTextToDocData(text){
  const raw = (text||"").replace(/\r/g,"");
  const lines = raw.split("\n").map(l=>l.trim()).filter(Boolean);

  // Helpers
  const pickAfter = (label)=>{
    const rx = new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\s*[:：]\\s*(.+)$","i");
    for(const l of lines){
      const m = l.match(rx);
      if(m) return m[1].trim();
    }
    return "";
  };

  const data = {
    title: "",
    subtitle: "",
    greetingName: "",
    intro: "",
    clientName: "",
    total: "",
    discount: "",
    totalWithDiscount: "",
    deposit: "",
    originalRemaining: "",
    pendingFinal: "",
    startDate: "",
    endDate: "",
    installmentsCount: "",
    installmentAmount: "",
    paymentDates: [],
    payLink: "",
    noteCost: "",
    noteDates: "",
    noteSupport: "",
    closing: "",
  };

  // Título: primera(s) líneas antes del saludo
  const idxGreeting = lines.findIndex(l=>/^estimad[ao],/i.test(l));
  if(idxGreeting > 0){
    data.title = lines[0] || "";
    if(lines[1] && /^\(.*\)$/.test(lines[1])) data.subtitle = lines[1];
  }

  // Saludo + nombre
  const greet = lines.find(l=>/^estimad[ao],/i.test(l));
  if(greet){
    const m = greet.match(/^estimad[ao],\s*(.+?)\s*:?\$/i);
    if(m) data.greetingName = m[1].replace(/:$/,"").trim();
  }

  data.clientName = pickAfter("Nombre del Cliente") || pickAfter("Nombre del cliente");
  data.total = pickAfter("Monto Total del Viaje");
  data.discount = pickAfter("Descuento aplicado");
  data.totalWithDiscount = pickAfter("Monto con Descuento");
  data.deposit = pickAfter("Monto de Reservación") || pickAfter("Monto de Reservacion");
  data.originalRemaining = pickAfter("Monto Total Original Restante");
  data.pendingFinal = pickAfter("Monto Pendiente Final");
  data.startDate = pickAfter("Fecha de Inicio de Pago");
  data.endDate = pickAfter("Fecha Final de Pago");
  data.installmentsCount = pickAfter("Cantidad de Cuotas");
  data.installmentAmount = pickAfter("Monto por Cuota");

  // Link de pago
  const ixPay = lines.findIndex(l=>/realiza\s+tus\s+pagos\s+aquí|realiza\s+tus\s+pagos\s+aqui/i.test(l));
  if(ixPay >= 0){
    const candidate = lines[ixPay+1] || "";
    if(/^https?:\/\//i.test(candidate)) data.payLink = candidate;
  }
  if(!data.payLink){
    const anyLink = lines.find(l=>/^https?:\/\//i.test(l));
    if(anyLink) data.payLink = anyLink;
  }

  // Fechas de pago
  const dateRows = [];
  const norm = (s)=>s.replace(/^•\s*/,"").trim();
  for(const l0 of lines){
    const l = norm(l0).replace(/^o\s+/i,"");
    let m = l.match(/^(\d+\s*(?:er|do|ro|to|mo)\s+pago)\s*:\s*(.+)$/i);
    if(m){ dateRows.push({label:m[1].trim(), date:m[2].trim()}); continue; }

    m = l.match(/^Pago\s*(\d+)\s*:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})(?:\s*[-–→>].*)?$/i);
    if(m){ dateRows.push({label:`Pago ${m[1]}`, date:m[2]}); continue; }
  }
  if(dateRows.length) data.paymentDates = dateRows;

  // Notas
  const noteCostLine = lines.find(l=>/^costo adicional\s*:/i.test(l));
  if(noteCostLine) data.noteCost = noteCostLine.replace(/^costo adicional\s*:\s*/i,"").trim();

  const noteDatesLine = lines.find(l=>/^fechas específicas\s*:/i.test(l) || /^fechas especificas\s*:/i.test(l));
  if(noteDatesLine) data.noteDates = noteDatesLine.replace(/^fechas (?:específicas|especificas)\s*:\s*/i,"").trim();

  const noteSupportLine = lines.find(l=>/^atención personalizada\s*:/i.test(l) || /^atencion personalizada\s*:/i.test(l));
  if(noteSupportLine) data.noteSupport = noteSupportLine.replace(/^atenci[oó]n personalizada\s*:\s*/i,"").trim();

  // Intro: usa la primera línea larga después del saludo (como en tu Word)
  data.intro = "Nos complace proporcionarle las opciones de pago personalizadas para completar el monto pendiente de su viaje. Este documento incluye detalles claros y flexibles para su planificación.";
  if(idxGreeting >= 0){
    const after = lines.slice(idxGreeting+1);
    const firstLong = after.find(l=>l.length>60);
    if(firstLong) data.intro = firstLong.trim();
  }

  // Cierre
  data.closing = "Estamos comprometidos con su satisfacción y con hacer que su experiencia sea memorable desde el inicio.";
  const closingLine = lines.find(l=>/^estamos comprometidos/i.test(l));
  if(closingLine) data.closing = closingLine.trim();

  if(!data.clientName) data.clientName = data.greetingName;

  return data;
}

function buildPaymentPlanPdfHTML({docData, hubSettings}){
  const d = docData || {};
  const s = hubSettings || {};

  const paymentDates = Array.isArray(d.paymentDates) ? d.paymentDates : [];
  const manyPayments = paymentDates.length > 7;

  const logoUrl = (s.company_logo_dataurl || s.company_logo_url || "").trim();

  const today = new Date();
  const dd = String(today.getDate()).padStart(2,"0");
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const yyyy = today.getFullYear();
  const genDate = `${dd}/${mm}/${yyyy}`;

  const safe = (v)=> (v==null? "" : String(v));
  const esc = (str)=> safe(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");

  const footerCompany = esc(s.footer_company || "Brianessa Travel | Tu agencia de viajes de confianza");
  const footerLine1  = esc(s.footer_line1  || "Teléfono: +1 (954) 294-9969 | Correo electrónico: BrianessaTravel@gmail.com");
  const footerLine2  = esc(s.footer_line2  || "Redes sociales: Instagram: @brianessa | Facebook: Brianessa Travel");
  const footerLine3  = esc(s.footer_line3  || "Sitio web: www.brianessatravelboutique.com");

  const footerHtml = `
    <div class="pdf-footer">
      <div class="pdf-small"><b>${footerCompany}</b></div>
      <div class="pdf-small">${footerLine1}</div>
      <div class="pdf-small">${footerLine2}</div>
      <div class="pdf-small">${footerLine3}</div>
    </div>
  `;

  // Helper: try to extract an amount from noteCost (first US$/RD$/$ match).
  function extractMoneyFromText(t){
    const m = safe(t).match(/(US\$|RD\$|\$)\s*[\d,.]+/);
    return m ? m[0].replace(/\s+/g," ") : "";
  }

  // Amount per row in the calendar (prefer amount in noteCost; fallback to installmentAmount)
  const perPayMoney = extractMoneyFromText(d.noteCost) || esc(d.installmentAmount || "");

  const topBar = `
    <div class="pdf-top keep-together" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div style="display:flex;align-items:center;gap:14px;min-width:0;">
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" style="height:52px;width:auto;object-fit:contain;border-radius:10px;">` : ``}
        <div style="min-width:0;">
          <div class="pdf-h2" style="margin:0;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.company_name || "Brianessa Travel | Tu agencia de viajes de confianza")}</div>
          <div class="pdf-small" style="margin-top:4px;color:#6B7280;">Plan de pagos</div>
        </div>
      </div>
      <div class="pdf-small" style="color:#6B7280;font-weight:700;white-space:nowrap;">Fecha: ${genDate}</div>
    </div>
  `;

  const titleBlock = `
    <div class="keep-together">
      <div class="pdf-h1">${esc(d.planTitleLine || "")}</div>
      <div class="pdf-small">${esc(d.greetingLine || "")}</div>
      <div class="pdf-p" style="margin-top:10px;">${esc(d.introParagraph || "")}</div>
    </div>
  `;

  const clientBlock = `
    <div class="pdf-section keep-together">
      <div class="pdf-h2">Datos del Cliente</div>
      <table class="pdf-table" style="margin-top:10px;">
        <tbody>
          ${safe(d.sectionClient || "").split("\n").filter(Boolean).map(line=>{
            const parts = line.split(":");
            const k = parts.shift();
            const v = parts.join(":").trim();
            if(!k || !v) return "";
            return `<tr><td style="width:55%;color:#6B7280;font-weight:700;">${esc(k.trim())}</td><td style="text-align:right;font-weight:800;">${esc(v)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  // Monthly summary: show only cuotas + monto por cuota (compact)
  const monthlyBlock = `
    <div class="pdf-section keep-together">
      <div class="pdf-h2">Modalidades de Pago Mensual</div>
      <table class="pdf-table" style="margin-top:10px;">
        <tbody>
          <tr>
            <td style="width:55%;color:#6B7280;font-weight:700;">Cantidad de Cuotas</td>
            <td style="text-align:right;font-weight:800;">${esc(d.installmentCount || "")}</td>
          </tr>
          <tr>
            <td style="width:55%;color:#6B7280;font-weight:700;">Monto por Cuota</td>
            <td style="text-align:right;font-weight:800;">${esc(d.installmentAmount || "")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const calendarRows = paymentDates.map((p, idx)=>{
    const pagoLabel = p.label ? p.label : `Pago ${idx+1}`;
    const fecha = p.date || "";
    const monto = (p.amount && String(p.amount).trim()) ? p.amount : perPayMoney;
    return `
      <tr>
        <td style="width:22%;font-weight:800;">${esc(pagoLabel)}</td>
        <td style="width:50%;">${esc(fecha)}</td>
        <td style="width:28%;text-align:right;font-weight:900;">${esc(monto)}</td>
      </tr>
    `;
  }).join("");

  const calendarBlock = `
    <div class="pdf-section">
      <div class="pdf-h2">Calendario de Pagos</div>
      <table class="pdf-table" style="margin-top:10px;">
        <thead>
          <tr>
            <th style="text-align:left;">Pago</th>
            <th style="text-align:left;">Fecha</th>
            <th style="text-align:right;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${calendarRows}
        </tbody>
      </table>
    </div>
  `;

  const payLinkBlock = `
    <div class="pdf-cta keep-together">
      👉 <b>Realiza tus pagos aquí</b><br>
      <a href="${esc(d.payLinkUrl || "#")}" style="color:#1D4ED8;text-decoration:none;font-weight:800;">${esc(d.payLinkUrl ? d.payLinkUrl : "(pendiente de link)")}</a>
    </div>
  `;

  const noteBlock = `
    <div class="pdf-section keep-together" style="margin-top:18px;">
      <div class="pdf-h2">Nota Importante</div>
      <div class="pdf-p" style="margin-top:10px;"><b>Costo Adicional:</b> ${esc(d.noteCost || "")}</div>
      <div class="pdf-p" style="margin-top:10px;"><b>Fechas específicas:</b> ${esc(d.noteDates || "")}</div>
      <div class="pdf-p" style="margin-top:10px;"><b>Atención personalizada:</b> ${esc(d.noteSupport || "")}</div>
    </div>
  `;

  if(!manyPayments){
    // <= 7 pagos: layout original (1 página)
    return `
      <div class="pdf-sheet">
        ${topBar}
        ${titleBlock}
        <div class="pdf-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
          ${clientBlock}
          <div>
            ${monthlyBlock}
            <div class="keep-together" style="margin-top:16px;">
              <div class="pdf-section">
                <div class="pdf-h2">Fechas de Pago</div>
                <table class="pdf-table" style="margin-top:10px;">
                  <thead>
                    <tr>
                      <th style="text-align:left;">Pago</th>
                      <th style="text-align:left;">Fecha</th>
                      <th style="text-align:right;">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${calendarRows}
                  </tbody>
                </table>
              </div>
              ${payLinkBlock}
            </div>
          </div>
        </div>
        ${noteBlock}
        ${footerHtml}
      </div>
    `;
  }

  // > 7 pagos: 2 páginas
  return `
    <div class="pdf-sheet">
      ${topBar}
      ${titleBlock}
      ${clientBlock}
      ${monthlyBlock}
      ${footerHtml}
    </div>

    <div class="pdf-sheet page-break">
      ${calendarBlock}
      <div style="margin-top:22px;">
        ${payLinkBlock}
      </div>
      ${noteBlock}
      ${footerHtml}
    </div>
  `;
}

function getPdfStylesForDoc(){
  // estilos mínimos para que el HTML quede igual al PDF (sin depender del CSS principal)
  const styleTag = document.getElementById("pdf-inline-styles");
  const base = styleTag ? (styleTag.textContent || "") : "";
  return base + `\n${extra_css.strip()}\n`;
}

function buildPaymentPlanHtmlDocument(p){
  const inner = buildPaymentPlanPdfHTML(p); // devuelve <div class="pdf-sheet">...</div>
  const css = getPdfStylesForDoc();
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plan de Pago - ${(p.clientName||p.clientDisplay||"Cliente")}</title>
<style>
${css}
body{margin:0;background:#ffffff;}
</style>
</head>
<body>
${inner}
</body>
</html>`;
}

function attachPaymentPlan(id){
  const p = state.paymentPlans.find(x=>x.id===id);
  if(!p){ toast("No encontré ese plan."); return; }

  // Abrir selector de archivo (PDF)
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf";
  input.onchange = (ev)=>{
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;

    if(file.type !== "application/pdf"){
      toast("Solo PDF, por favor.");
      return;
    }

    const reader = new FileReader();
    reader.onload = ()=>{
      const dataUrl = reader.result;
      p.attachmentPdf = {
        name: file.name || "plan_pago.pdf",
        type: file.type,
        size: file.size,
        dataUrl,
        attachedAt: new Date().toISOString()
      };
      saveState();
      renderPaymentPlans();
      toast("PDF adjuntado ✅");
    };
    reader.onerror = ()=>{
      console.error(reader.error);
      toast("No pude leer el PDF.");
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
window.attachPaymentPlan = attachPaymentPlan;

function downloadPaymentPlanAttachment(id){
  const p = state.paymentPlans.find(x=>x.id===id);
  if(!p || !p.attachmentPdf || !p.attachmentPdf.dataUrl){
    toast("Este plan no tiene PDF adjunto.");
    return;
  }
  const a = document.createElement("a");
  a.href = p.attachmentPdf.dataUrl;
  a.download = p.attachmentPdf.name || "plan_pago.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Descargando PDF…");
}
window.downloadPaymentPlanAttachment = downloadPaymentPlanAttachment;

function previewPaymentPlanAttachment(id){
  const p = state.paymentPlans.find(x=>x.id===id);
  if(!p || !p.attachmentPdf || !p.attachmentPdf.dataUrl){
    toast("Este plan no tiene PDF adjunto.");
    return;
  }

  const win = window.open("", "_blank");
  if(!win){
    toast("Tu navegador bloqueó el popup. Permite popups para previsualizar.");
    return;
  }

  const safeTitle = escapeHtml(p.planName || "PDF adjunto");
  win.document.open();
  win.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeTitle}</title>
<style>
  body{margin:0;background:#0b0b0f;color:#fff;font-family:Arial,Helvetica,sans-serif;}
  header{padding:12px 14px;background:#101018;border-bottom:1px solid rgba(255,255,255,.08);display:flex;gap:10px;align-items:center;justify-content:space-between;}
  .t{font-weight:700}
  .btn{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;padding:8px 10px;border-radius:10px;cursor:pointer}
  .btn:hover{background:rgba(255,255,255,.10)}
  iframe{width:100%;height:calc(100vh - 54px);border:0;background:#111}
</style>
</head>
<body>
<header>
  <div class="t">${safeTitle}</div>
  <div>
    <button class="btn" onclick="window.print()">Imprimir</button>
    <button class="btn" onclick="window.close()">Cerrar</button>
  </div>
</header>
<iframe src="${p.attachmentPdf.dataUrl}" title="PDF"></iframe>
</body>
</html>`);
  win.document.close();
}
window.previewPaymentPlanAttachment = previewPaymentPlanAttachment;

function removePaymentPlanAttachment(id){
  const p = state.paymentPlans.find(x=>x.id===id);
  if(!p){ toast("No encontré ese plan."); return; }
  if(!p.attachmentPdf){ toast("Este plan no tiene PDF adjunto."); return; }

  const ok = confirm("¿Quitar el PDF adjunto de este plan?");
  if(!ok) return;

  p.attachmentPdf = null;
  saveState();
  renderPaymentPlans();
  toast("Adjunto eliminado ✅");
}
window.removePaymentPlanAttachment = removePaymentPlanAttachment;


async function copyTextToClipboardFromUrl(url){
  try{
    const res = await fetch(url);
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    toast("HTML copiado ✅");
  }catch(e){
    console.error(e);
    toast("No pude copiar. Prueba descargando el HTML.");
  }
}
window.copyTextToClipboardFromUrl = copyTextToClipboardFromUrl;


function exportPaymentPlanPDF(id){
  const p = state.paymentPlans.find(x=>x.id===id);
  if(!p){ toast("No encontré ese plan."); return; }

  // Generar data para el PDF desde el texto que ya está en el plan
  const docData = parsePaymentPlanTextToDocData(p.generatedText || "");
  const hubSettings = getHubSettings();

  // Contenedor temporal (no visible)
  let root = document.getElementById("pdf-root");
  if(!root){
    root = document.createElement("div");
    root.id = "pdf-root";
    root.style.position = "fixed";
    root.style.left = "-99999px";
    root.style.top = "0";
    root.style.width = "210mm";
    document.body.appendChild(root);
  }

  // Inyectar estilos + HTML
  const styles = getPdfStylesForDoc({docData, hubSettings});
  root.innerHTML = `<style>${styles}</style>` + buildPaymentPlanPdfHTML({docData, hubSettings});

  if(!window.html2pdf){
    toast("No encontré html2pdf en la página. Revisa el script en index.html.");
    return;
  }

  const filename = (p.filename || `PlanPago_${(p.clientName||"Cliente").replaceAll(" ","_")}_${(p.tripName||"Viaje").replaceAll(" ","_")}`) + ".pdf";

  // html2pdf options (A4)
  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] }
  };

  // Esperar un frame para que el browser calcule layout antes de renderizar
  requestAnimationFrame(()=>{
    window.html2pdf().set(opt).from(root).save()
      .then(()=>{ toast("PDF descargado."); })
      .catch((e)=>{
        console.error(e);
        toast("No pude generar el PDF. Revisa consola.");
      });
  });
}


function exportPaymentPlanPDF_fallback(p){
  let text = (p.text||"").trim();
  if(!text){
    const cliente = (p.clientName || p.clientDisplay || "Cliente");
    const viaje = (p.tripName || p.tripDisplay || "Viaje");
    text = `${state.settings.companyName || ""}\n\nPlan de pago\nCliente: ${cliente}\nViaje: ${viaje}\nMoneda: ${p.currency || state.settings.currencyDefault || ""}\nInicio: ${p.startDate || ""}\n`;
  }

  if(!window.jspdf || !window.jspdf.jsPDF){
    toast("No se cargó jsPDF/html2pdf (revisa tu conexión).");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"a4" });

  const margin = 48;
  const lineH = 14;

  const title = (p.clientName || p.clientDisplay || "Plan de Pago") + ((p.tripName || p.tripDisplay) ? " - " + (p.tripName || p.tripDisplay) : "");
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(title, margin, 60);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);

  const lines = doc.splitTextToSize(text, 595 - margin*2); // A4 width ~595pt
  let y = 90;

  for(const ln of lines){
    if(y > 800){ doc.addPage(); y = 60; }
    doc.text(ln, margin, y);
    y += lineH;
  }

  const safeClient = (p.clientName || p.clientDisplay || "plan").toString().trim().replace(/[^\w\-]+/g,"_");
  const safeTrip = (p.tripName || p.tripDisplay || "").toString().trim().replace(/[^\w\-]+/g,"_");
  const filename = `PlanPago_${safeClient}${safeTrip?("_"+safeTrip):""}.pdf`;
  doc.save(filename);
}

// Hacer accesible para onclick inline (por si el navegador no lo expone automáticamente)
window.exportPaymentPlanPDF = exportPaymentPlanPDF;



function deletePaymentPlan(id){ state.paymentPlans = state.paymentPlans.filter(x=>x.id!==id); saveState(); render(); }

function viewPaymentPlan(id){
  const p = state.paymentPlans.find(x=>x.id===id);
  if(!p) return;
  openModal({
    title:"Ver plan de pago",
    bodyHtml: `
      <div class="card">
        <div class="row">
          <div>
            <strong>${escapeHtml(p.clientName || p.clientDisplay || "Plan de Pago")}</strong>
            <div class="kbd">${escapeHtml(p.tripName || p.tripDisplay || "")}</div>
          </div>
          <span class="badge">${escapeHtml(p.currency||"")}</span>
        </div>
        <hr/>
        <div class="field"><label>Texto</label><textarea readonly>${escapeHtml(p.text||"")}</textarea></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn" id="copyPlan">Copiar</button>
        </div>
      </div>
    `,
    onSave: ()=> closeModal()
  });
  document.getElementById("copyPlan").onclick = ()=> navigator.clipboard.writeText(p.text||"");
}


function editPaymentPlan(id){
  const p = state.paymentPlans.find(x=>x.id===id);
  if(!p){ toast("No encontré ese plan."); return; }
  openPaymentPlanModal(p);
}
window.editPaymentPlan = editPaymentPlan;



/* =========================
   ITINERARIES (ESTILO PERÚ)
========================= */
function renderItineraries(){
  const rows = state.itineraries.filter(matchesSearch).map(i=>`
    <tr>
      <td><strong>${escapeHtml(i.title)}</strong><div class="kbd">${escapeHtml(i.tripName||i.tripDisplay||"")}</div></td>
      <td>${(i.days||[]).length}</td>
      <td>${escapeHtml(i.updatedAt||"")}</td>
      <td>
        <button class="btn" onclick="viewItinerary('${i.id}')">Ver</button>
        <button class="btn" onclick="editItinerary('${i.id}')">Editar</button>
        <button class="btn danger" onclick="deleteItinerary('${i.id}')">Eliminar</button>
      </td>
    </tr>
  `).join("");

  setContent(`
    <div class="card">
      ${renderModuleToolbar("itineraries",
        `<div><h2 style="margin:0;">Itinerarios</h2><div class="kbd">Resumen + incluye/no incluye + día a día con comidas incluidas.</div></div>`,
        `<button class="btn primary" onclick="openItineraryModal()">+ Nuevo itinerario</button>`
      )}
      <hr/>
      <table class="table">
        <thead><tr><th>Itinerario</th><th>Días</th><th>Actualizado</th><th>Acciones</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="kbd">No hay itinerarios todavía.</td></tr>`}</tbody>
      </table>
    </div>
  `);
}

function openItineraryModal(existing=null){
  const tripOptions = state.trips.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");

  openModal({
    title: existing ? "Editar itinerario" : "Nuevo itinerario",
    bodyHtml: `
      <div class="field"><label>Título</label><input id="iTitle" value="${escapeHtml(existing?.title||"Itinerario de Viaje")}" /></div>

      <div class="grid">
        <div class="field col-6">
          <label>Viaje (opcional)</label>
          <select id="iTrip"><option value="">(Sin seleccionar)</option>${tripOptions}</select>
        </div>
        <div class="field col-6">
          <label>Nombre del viaje (si no usas select)</label>
          <input id="iTripDisplay" value="${escapeHtml(existing?.tripDisplay||"")}" placeholder="Ej: Perú y Machu Picchu" />
        </div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Salida (fecha)</label><input id="iStart" type="date" value="${escapeHtml(existing?.startDate||"")}" /></div>
        <div class="field col-6"><label>Llegada (fecha)</label><input id="iEnd" type="date" value="${escapeHtml(existing?.endDate||"")}" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Inversión</label><input id="iPrice" value="${escapeHtml(existing?.price||"")}" placeholder="Ej: 2869" /></div>
        <div class="field col-6"><label>Inversión con extensión (opcional)</label><input id="iPriceExt" value="${escapeHtml(existing?.priceExt||"")}" placeholder="Ej: 3449" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Reserva (texto)</label><input id="iDepositText" value="${escapeHtml(existing?.depositText||"RESERVA SOLO CON $250")}" /></div>
        <div class="field col-6"><label>Link (Regístrate aquí)</label><input id="iLink" value="${escapeHtml(existing?.ctaLink||"")}" placeholder="Pega el link" /></div>
      </div>

      <div class="grid">
        <div class="field col-6"><label>Incluye (1 por línea)</label>
          <textarea id="iIncludes" placeholder="Ej: Boletos aéreos...">${escapeHtml((existing?.includes||[]).join("\n"))}</textarea>
        </div>
        <div class="field col-6"><label>No incluye (1 por línea)</label>
          <textarea id="iExcludes" placeholder="Ej: Seguro de asistencia...">${escapeHtml((existing?.excludes||[]).join("\n"))}</textarea>
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
        <textarea id="iText" placeholder="Aquí sale el itinerario...">${escapeHtml(existing?.text||"")}</textarea>
      </div>
    `,
    onSave: ()=>{
      const tripId = document.getElementById("iTrip").value || "";
      const tripObj = state.trips.find(t=>t.id===tripId);

      const title = document.getElementById("iTitle").value.trim() || "Itinerario de Viaje";
      const tripDisplay = document.getElementById("iTripDisplay").value.trim();
      const startDate = document.getElementById("iStart").value || "";
      const endDate = document.getElementById("iEnd").value || "";
      const price = parseNum(document.getElementById("iPrice").value);
      const priceExt = parseNum(document.getElementById("iPriceExt").value);
      const depositText = document.getElementById("iDepositText").value.trim();
      const ctaLink = document.getElementById("iLink").value.trim();

      const includes = document.getElementById("iIncludes").value.split("\n").map(x=>x.trim()).filter(Boolean);
      const excludes = document.getElementById("iExcludes").value.split("\n").map(x=>x.trim()).filter(Boolean);

      let days = [];
      try{ days = JSON.parse(document.getElementById("iDays").value || "[]"); }
      catch{ alert("El JSON de días no es válido."); return; }

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

      if(existing) Object.assign(existing, payload);
      else state.itineraries.push(payload);

      saveState(); closeModal(); render();
    }
  });

  if(existing?.tripId) document.getElementById("iTrip").value = existing.tripId;

  document.getElementById("iGenerate").onclick = ()=>{
    const s = state.settings;
    const title = document.getElementById("iTitle").value.trim() || "Itinerario de Viaje";
    const tripName = document.getElementById("iTripDisplay").value.trim() || "Viaje grupal";
    const start = document.getElementById("iStart").value || "";
    const end = document.getElementById("iEnd").value || "";
    const price = parseNum(document.getElementById("iPrice").value);
    const priceExt = parseNum(document.getElementById("iPriceExt").value);
    const depositText = document.getElementById("iDepositText").value.trim();
    const link = document.getElementById("iLink").value.trim();

    const includes = document.getElementById("iIncludes").value.split("\n").map(x=>x.trim()).filter(Boolean);
    const excludes = document.getElementById("iExcludes").value.split("\n").map(x=>x.trim()).filter(Boolean);

    let days = [];
    try{ days = JSON.parse(document.getElementById("iDays").value || "[]"); }
    catch{ alert("El JSON de días no es válido."); return; }

    let out = "";
    out += `${tripName}\nViaje grupal\n${title}\n\n`;
    out += `RESUMEN\n`;
    out += `Fecha de viaje:\nSalida: ${formatDateLongISO(start)}\nLlegada: ${formatDateLongISO(end)}\n\n`;
    if(price) out += `INVERSIÓN: ${toMoney(price, "USD")}\n`;
    if(priceExt) out += `INVERSIÓN CON EXTENSIÓN: ${toMoney(priceExt, "USD")}\n`;
    if(depositText) out += `${depositText}\n`;
    out += `PLANES DE PAGO DISPONIBLES\n\n`;

    if(includes.length){
      out += `EL PAQUETE INCLUYE\n`;
      includes.forEach(x=> out += `• ${x}\n`);
      out += `\n`;
    }
    if(excludes.length){
      out += `EL PAQUETE NO INCLUYE\n`;
      excludes.forEach(x=> out += `• ${x}\n`);
      out += `\n`;
    }

    if(days.length){
      days.forEach((d, idx)=>{
        out += `${d.day || `DÍA ${idx+1}`}${d.title ? `: ${d.title}` : ""}\n`;
        if(d.meals) out += `Comidas Incluidas: ${d.meals}\n`;
        if(d.content) out += `${d.content}\n`;
        out += `\n`;
      });
    }

    if(link){
      out += `Regístrate aquí\n${link}\n\n`;
    }

    // firma empresa
    out += `${s.companyName}\nTeléfono: ${s.phone} | Correo: ${s.email}\nInstagram: ${s.instagram} | Facebook: ${s.facebook}\nSitio web: ${s.website}\n`;

    document.getElementById("iText").value = out;
  };
}

function editItinerary(id){ const i = state.itineraries.find(x=>x.id===id); if(i) openItineraryModal(i); }
function deleteItinerary(id){ state.itineraries = state.itineraries.filter(x=>x.id!==id); saveState(); render(); }

function viewItinerary(id){
  const i = state.itineraries.find(x=>x.id===id);
  if(!i) return;
  openModal({
    title:"Ver itinerario",
    bodyHtml: `
      <div class="card">
        <div class="row">
          <div>
            <strong>${escapeHtml(i.title)}</strong>
            <div class="kbd">${escapeHtml(i.tripName || i.tripDisplay || "")}</div>
          </div>
          <span class="badge">${(i.days||[]).length} días</span>
        </div>
        <hr/>
        <div class="field"><label>Texto</label><textarea readonly>${escapeHtml(i.text||"")}</textarea></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn" id="copyIti">Copiar</button>
        </div>
      </div>
    `,
    onSave: ()=> closeModal()
  });
  document.getElementById("copyIti").onclick = ()=> navigator.clipboard.writeText(i.text||"");
}

/* =========================
   CAMPAIGNS / TEMPLATES / AI (placeholder)
========================= */
function renderCampaigns(){
  setContent(`
    <div class="card">
      ${renderModuleToolbar("campaigns",
        `<div><h2 style="margin:0;">Campañas</h2><div class="kbd">Aquí entran Email/SMS por viaje/segmento.</div></div>`,
        `<span class="badge">Próximo</span>`
      )}
      <hr/>
      <div class="kbd">Siguiente incremento: editor HTML (email) + plantillas SMS + variables ({{nombre}}, {{link_pago}}).</div>
    </div>
  `);
}
function renderTemplates(){
  setContent(`
    <div class="card">
      ${renderModuleToolbar("templates",
        `<div><h2 style="margin:0;">Plantillas</h2><div class="kbd">Textos y HTML listos para copiar/pegar.</div></div>`,
        `<span class="badge">Próximo</span>`
      )}
      <hr/>
      <div class="kbd">Aquí guardaremos tu formato de email y disclaimers por viaje.</div>
    </div>
  `);
}
function renderAI(){
  setContent(`
    <div class="card">
      ${renderModuleToolbar("ai",
        `<div><h2 style="margin:0;">Asistente IA</h2><div class="kbd">Preparado para conectar a un endpoint seguro (/api/chat).</div></div>`,
        ``
      )}
      <hr/>
      <div class="field"><label>Prompt</label>
        <textarea id="aiPrompt" placeholder="Ej: genera un plan de pago con estos datos..."></textarea>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" id="aiSend">Enviar</button>
        <button class="btn" id="aiSample">Ejemplo</button>
      </div>
      <hr/>
      <div class="field"><label>Respuesta</label>
        <textarea id="aiResp" readonly placeholder="Aquí saldrá la respuesta..."></textarea>
      </div>
      <button class="btn" id="aiCopy">Copiar</button>
      <div class="kbd" style="margin-top:10px;">Importante: no pongas la API key en el frontend. Se usa backend.</div>
    </div>
  `);

  document.getElementById("aiSample").onclick = ()=>{
    document.getElementById("aiPrompt").value =
`Eres asistente de Brianessa Travel.
Crea un plan de pago en el formato oficial (encabezado, datos, cuotas, nota tarjeta).
Datos: total 3797, descuento 300, reserva 250, inicio 2026-02-16, fin 2026-09-30, frecuencia Mensual, forma Tarjeta, link: ...`;
  };

  document.getElementById("aiSend").onclick = async ()=>{
    const prompt = document.getElementById("aiPrompt").value.trim();
    if(!prompt) return;
    const out = document.getElementById("aiResp");
    out.value = "Procesando...";
    try{
      const r = await fetch("/api/chat", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ prompt }) });
      const data = await r.json();
      out.value = data.text || JSON.stringify(data, null, 2);
    }catch{
      out.value = "No se pudo conectar a /api/chat (luego montamos el endpoint).";
    }
  };
  document.getElementById("aiCopy").onclick = ()=> navigator.clipboard.writeText(document.getElementById("aiResp").value || "");
}

function renderSettings(){
  const s = state.settings;
  setContent(`
    <div class="card">
      ${renderModuleToolbar("settings",
        `<div><h2 style="margin:0;">Configuración</h2><div class="kbd">Datos de la agencia + % recargo tarjeta.</div></div>`,
        `<button class="btn primary" onclick="openSettingsModal()">Editar</button>`
      )}
      <hr/>
      <div class="grid">
        <div class="card col-6"><strong>Empresa</strong><div class="kbd">${escapeHtml(s.companyName)}</div></div>
        <div class="card col-6"><strong>Recargo tarjeta</strong><div class="kbd">${escapeHtml(String(s.cardFeePct))}%</div></div>
      </div>
    </div>
  `);
}

function openSettingsModal(){
  const s = state.settings;
  openModal({
    title:"Editar configuración",
    bodyHtml: `
      <div class="field"><label>Company header</label><input id="sCompany" value="${escapeHtml(s.companyName)}" /></div>
      <div class="grid">
        <div class="field col-6"><label>Tel</label><input id="sPhone" value="${escapeHtml(s.phone)}" /></div>
        <div class="field col-6"><label>Email</label><input id="sEmail" value="${escapeHtml(s.email)}" /></div>
      </div>
      <div class="grid">
        <div class="field col-6"><label>Instagram</label><input id="sIg" value="${escapeHtml(s.instagram)}" /></div>
        <div class="field col-6"><label>Facebook</label><input id="sFb" value="${escapeHtml(s.facebook)}" /></div>
      </div>
      <div class="grid">
        <div class="field col-6"><label>Website</label><input id="sWeb" value="${escapeHtml(s.website)}" /></div>
        <div class="field col-6"><label>% Recargo tarjeta</label><input id="sFee" value="${escapeHtml(String(s.cardFeePct))}" /></div>
      </div>
    `,
    onSave: ()=>{
      s.companyName = document.getElementById("sCompany").value.trim() || s.companyName;
      s.phone = document.getElementById("sPhone").value.trim() || s.phone;
      s.email = document.getElementById("sEmail").value.trim() || s.email;
      s.instagram = document.getElementById("sIg").value.trim() || s.instagram;
      s.facebook = document.getElementById("sFb").value.trim() || s.facebook;
      s.website = document.getElementById("sWeb").value.trim() || s.website;
      s.cardFeePct = parseNum(document.getElementById("sFee").value) || s.cardFeePct;

      saveState(); closeModal(); render();
    }
  });
}

/* =========================
   QUICK MENU
========================= */
function openQuickMenu(){
  openModal({
    title:"Nuevo",
    bodyHtml: `
      <div class="card">
        <p>¿Qué quieres crear ahora?</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" id="qPlan">Plan de pago</button>
          <button class="btn primary" id="qIti">Itinerario</button>
          <button class="btn" id="qClient">Cliente</button>
          <button class="btn" id="qTrip">Viaje</button>
        </div>
      </div>
    `,
    onSave: ()=> closeModal()
  });

  document.getElementById("qPlan").onclick = ()=>{ closeModal(); navigate("payment-plans"); openPaymentPlanModal(); };
  document.getElementById("qIti").onclick = ()=>{ closeModal(); navigate("itineraries"); openItineraryModal(); };
  document.getElementById("qClient").onclick = ()=>{ closeModal(); navigate("clients"); openClientModal(); };
  document.getElementById("qTrip").onclick = ()=>{ closeModal(); navigate("trips"); openTripModal(); };
}

/* =========================
   EXPORT / IMPORT (All + scoped)
========================= */
function exportJSON({scope}){
  let payload;

  if(scope === "all"){
    payload = state;
  }else{
    // scoped export: incluye settings + solo ese bloque
    payload = { settings: state.settings };
    if(scope === "clients") payload.clients = state.clients;
    if(scope === "trips") payload.trips = state.trips;
    if(scope === "paymentPlans") payload.paymentPlans = state.paymentPlans;
    if(scope === "itineraries") payload.itineraries = state.itineraries;
    if(scope === "campaigns") payload.campaigns = state.campaigns;
    if(scope === "templates") payload.templates = state.templates;
    if(scope === "settings") payload.settings = state.settings;
    if(scope === "ai") payload.ai = {}; // reservado
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brianessa_${scope}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJSON(ev, {scope}){
  const file = ev.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);

    // merge settings siempre si vienen
    if(data.settings) state.settings = { ...state.settings, ...data.settings };

    if(scope === "all"){
      // merge por secciones para no reventar si falta algo
      if(Array.isArray(data.clients)) state.clients = mergeById(state.clients, data.clients);
      if(Array.isArray(data.trips)) state.trips = mergeById(state.trips, data.trips);
      if(Array.isArray(data.paymentPlans)) state.paymentPlans = mergeById(state.paymentPlans, data.paymentPlans);
      if(Array.isArray(data.itineraries)) state.itineraries = mergeById(state.itineraries, data.itineraries);
      if(Array.isArray(data.campaigns)) state.campaigns = mergeById(state.campaigns, data.campaigns);
      if(data.templates) state.templates = { ...state.templates, ...data.templates };
    }else{
      if(scope === "clients" && Array.isArray(data.clients)) state.clients = mergeById(state.clients, data.clients);
      if(scope === "trips" && Array.isArray(data.trips)) state.trips = mergeById(state.trips, data.trips);
      if(scope === "paymentPlans" && Array.isArray(data.paymentPlans)) state.paymentPlans = mergeById(state.paymentPlans, data.paymentPlans);
      if(scope === "itineraries" && Array.isArray(data.itineraries)) state.itineraries = mergeById(state.itineraries, data.itineraries);
      if(scope === "campaigns" && Array.isArray(data.campaigns)) state.campaigns = mergeById(state.campaigns, data.campaigns);
      if(scope === "templates" && data.templates) state.templates = { ...state.templates, ...data.templates };
      if(scope === "settings" && data.settings) state.settings = { ...state.settings, ...data.settings };
    }

    refreshTripNames();
    saveState();
    closeModal();
    render();
  }catch(e){
    alert("No se pudo importar. Verifica que sea un JSON válido.");
  }finally{
    ev.target.value = "";
  }
}

function mergeById(current, incoming){
  const map = new Map((current||[]).map(x=>[x.id, x]));
  (incoming||[]).forEach(x=>{
    if(x && x.id){
      map.set(x.id, { ...(map.get(x.id)||{}), ...x });
    }else{
      map.set(uid("imp"), { id: uid("imp"), ...x });
    }
  });
  return Array.from(map.values());
}

/* =========================
   Expose for onclick
========================= */
window.exportJSON = exportJSON;
window.openImportModal = openImportModal;

window.openPaymentPlanModal = openPaymentPlanModal;
window.editPaymentPlan = editPaymentPlan;
window.deletePaymentPlan = deletePaymentPlan;
window.viewPaymentPlan = viewPaymentPlan;

window.openItineraryModal = openItineraryModal;
window.editItinerary = editItinerary;
window.deleteItinerary = deleteItinerary;
window.viewItinerary = viewItinerary;

window.openClientModal = openClientModal;
window.editClient = editClient;
window.deleteClient = deleteClient;

window.openTripModal = openTripModal;
window.editTrip = editTrip;
window.deleteTrip = deleteTrip;

window.openSettingsModal = openSettingsModal;
