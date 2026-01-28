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
// Convertir archivo a DataURL (con resize) para guardar en localStorage
async function fileToDataUrl(file, maxW=300, maxH=300){
  const dataUrl = await new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  // Resize usando canvas
  return await new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      let w = img.width, h = img.height;
      const scale = Math.min(1, maxW/w, maxH/h);
      const nw = Math.max(1, Math.round(w*scale));
      const nh = Math.max(1, Math.round(h*scale));
      const c = document.createElement("canvas");
      c.width = nw; c.height = nh;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, nw, nh);
      resolve(c.toDataURL("image/png", 0.92));
    };
    img.onerror = ()=>resolve(dataUrl);
    img.src = dataUrl;
  });
}

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
      <button class="menu-item" onclick="generateAndAttachPaymentPlanPDF('${p.id}')">
        <span class="mi-ic">${icon('paperclip')}</span>
        <span class="mi-tx">Generar y adjuntar PDF</span>
      </button>
      <div class="menu-sep"></div>
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
  document.querySelectorAll('[id^="plan-menu-"]').forEach(el=>{
    el.hidden = true;
    const tr = el.closest('tr');
    if(tr) tr.classList.remove('menu-open');
  });
}
function togglePlanMenu(ev, id){
  ev.preventDefault();
  ev.stopPropagation();

  const el = document.getElementById(`plan-menu-${id}`);
  if(!el) return;

  const tr = el.closest('tr');
  const willOpen = el.hidden;

  closeAllPlanMenus();

  el.hidden = !willOpen;
  if(willOpen && tr) tr.classList.add('menu-open');
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
      out += `Costo Adicional: El monto por cuota es de ${toMoney(montoCuotaTarjeta, currency)} debido a un cargo adicional de 3.5% por el uso de tarjeta de crédito/débito. Este cargo cubre los costos de procesamiento y es una tarifa estándar para pagos con tarjeta.\n`;
      out += `Fechas específicas: Las fechas indicadas son las programadas para sus pagos según la modalidad seleccionada. Si necesita realizar algún ajuste, contáctenos a la brevedad.\n`;
      out += `Atención personalizada: Nuestro equipo está a su disposición para aclarar cualquier duda o atender cualquier necesidad adicional.\n`;
    }

    document.getElementById("pText").value = out;
  };
}




const PDF_FOOTER_IMG = "data:image/png;base64,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";

// =========================
// TEXTO: construir documento de plan de pagos (formato "Diana" / Escala Dubai)
// =========================
function buildPaymentPlanTextFromPlan(p){
  const s = state.settings || {};
  const currency = (p.currency || s.currencyDefault || "USD");
  const total = Number(p.total||0);
  const descuento = Number(p.discount||0);
  const reserva = Number(p.deposit||0);
  const totalDesc = Math.max(0, total - descuento);
  const restante = Math.max(0, totalDesc - reserva);

  const startISO = (p.startDate||"");
  const endISO   = (p.endDate||"");
  const freq = (p.freq||"Mensual");
  const method = (p.method||"Transferencia");
  const link = (p.paymentLink||"");
  const cliente = (p.clientName || p.clientDisplay || "Cliente").trim();
  const viajeBase = (p.tripName || p.tripDisplay || "").trim();
  const extra = (p.extra || "").trim();
  const viaje = viajeBase || "—";

  const dates = buildScheduleDates({startISO, endISO, frequency: freq});
  const cuotas = dates.length || 0;
  const montos = cuotas ? splitInstallments(restante, cuotas) : [];
  const montoCuotaBase = cuotas ? montos[0] : 0;

  // Tarjeta: 3.5% fijo
  const feePct = 3.5;
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
  out += `• Fechas de Pago:\n`;
  dates.forEach((d, i)=>{ out += `o ${ordinalPago(i)} pago: ${formatDateLongISO(d)}\n`; });

  out += `\n👉 Realiza tus pagos aquí\n${link || "(pendiente de link)"}\n\n`;

  if(method === "Tarjeta"){
    out += `Nota Importante\n`;
    out += `Costo Adicional: El monto por cuota es de ${toMoney(montoCuotaTarjeta, currency)} debido a un cargo adicional de ${feePct}% por el uso de tarjeta de crédito/débito. Este cargo cubre los costos de procesamiento y es una tarifa estándar para pagos con tarjeta.\n`;
    out += `Fechas específicas: Las fechas indicadas son las programadas para sus pagos según la modalidad seleccionada. Si necesita realizar algún ajuste, contáctenos a la brevedad.\n`;
    out += `Atención personalizada: Nuestro equipo está a su disposición para aclarar cualquier duda o atender cualquier necesidad adicional.\n`;
  }

  return out;
}



// =========================
// GENERAR + ADJUNTAR: PDF del plan (se guarda dentro del plan)
// =========================
async function generateAndAttachPaymentPlanPDF(planId){
  const plan = state.paymentPlans.find(p=>p.id===planId);
  if(!plan){ toast("Plan no encontrado."); return; }

  if(!plan.text || !plan.text.trim()){
    plan.text = buildPaymentPlanTextFromPlan(plan);
  }

  if(!window.html2pdf){
    toast("No se cargó html2pdf. Revisa index.html.");
    return;
  }

  const host = document.getElementById("pdf-root");
  if(!host){ toast("No existe #pdf-root."); return; }

  host.innerHTML = buildPaymentPlanPdfHTML(plan);

  try{
    const filename = safeFilename(`PlanPago_${(plan.clientName||plan.clientDisplay||"Cliente")}_${(plan.tripName||plan.tripDisplay||"Viaje")}.pdf`);
    const opt = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] }
    };

    const worker = window.html2pdf().set(opt).from(host);
    const blob = await worker.outputPdf("blob");
    const dataUrl = await blobToDataURL(blob);

    plan.attachmentPdf = dataUrl;
    saveState(state);
    toast("PDF generado y adjuntado ✅");
    renderPaymentPlans();
  }catch(err){
    console.error(err);
    toast("No se pudo generar/adjuntar el PDF.");
  }finally{
    host.innerHTML = "";
  }
}

function blobToDataURL(blob){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
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

function buildPaymentPlanPdfHTML(plan){
  const s = state.settings || {};
  const currency = (plan.currency || s.currencyDefault || "USD");
  const feePct = 3.5;

  const total = Number(plan.total||0);
  const descuento = Number(plan.discount||0);
  const reserva = Number(plan.deposit||0);
  const totalDesc = Math.max(0, total - descuento);
  const restante = Math.max(0, totalDesc - reserva);

  const startISO = (plan.startDate||"");
  const endISO   = (plan.endDate||"");
  const freq = (plan.freq||"Mensual");
  const method = (plan.method||"Transferencia");
  const link = (plan.paymentLink||"");
  const cliente = (plan.clientName || plan.clientDisplay || "Cliente").trim();
  const viajeBase = (plan.tripName || plan.tripDisplay || "").trim();
  const extra = (plan.extra || "").trim();
  const viaje = viajeBase || "—";

  const dates = buildScheduleDates({startISO, endISO, frequency: freq});
  const cuotas = dates.length || 0;
  const isLongSchedule = cuotas > 7;
  const montos = cuotas ? splitInstallments(restante, cuotas) : [];
  const montoCuotaBase = cuotas ? montos[0] : 0;
  const montoCuotaTarjeta = round2(montoCuotaBase * (1 + (feePct/100)));

  const titulo = `Plan de Pagos Para el Viaje a ${escapeHtml(viaje)}`;

  const kv = (k,v)=>`<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`;

  const fechasListHtml = dates.map((d,i)=>{
    const baseAmt = montos[i] ?? montoCuotaBase;
    const amt = (method==="Tarjeta") ? round2(baseAmt*(1+feePct/100)) : baseAmt;
    return `<li>
      <div class="pdf-pay-left">
        <div><b>Pago ${i+1}</b></div>
        <div class="muted">${escapeHtml(formatDateLongISO(d))}</div>
      </div>
      <span class="amt">${escapeHtml(toMoney(amt, currency))}</span>
    </li>`;
  }).join("");

  const fechasTableRows = dates.map((d,i)=>{
    const baseAmt = montos[i] ?? montoCuotaBase;
    const amt = (method==="Tarjeta") ? round2(baseAmt*(1+feePct/100)) : baseAmt;
    return `<tr>
      <td class="pdf-td">Pago ${i+1}</td>
      <td class="pdf-td">${escapeHtml(formatDateLongISO(d))}</td>
      <td class="pdf-td pdf-right">${escapeHtml(toMoney(amt, currency))}</td>
    </tr>`;
  }).join("");

  const notaTarjeta = (method==="Tarjeta")
    ? `<div class="pdf-note">
        <div class="pdf-note-title">Nota Importante</div>
        <div><b>Costo Adicional:</b> El monto por cuota es de <b>${escapeHtml(toMoney(montoCuotaTarjeta, currency))}</b> debido a un cargo adicional de <b>${feePct}%</b> por el uso de tarjeta de crédito/débito. Este cargo cubre los costos de procesamiento y es una tarifa estándar para pagos con tarjeta.</div>
        <div style="margin-top:8px;"><b>Fechas específicas:</b> Las fechas indicadas son las programadas para sus pagos según la modalidad seleccionada. Si necesita realizar algún ajuste, contáctenos a la brevedad.</div>
        <div style="margin-top:8px;"><b>Atención personalizada:</b> Nuestro equipo está a su disposición para aclarar cualquier duda o atender cualquier necesidad adicional.</div>
      </div>`
    : ``;

  const genDate = new Date();
  const dd = String(genDate.getDate()).padStart(2,"0");
  const mm = String(genDate.getMonth()+1).padStart(2,"0");
  const yyyy = genDate.getFullYear();
  const fechaGen = `${dd}/${mm}/${yyyy}`;

  // Header (estilo pdf-5): logo badge + texto, fecha a la derecha
  const brandLine = escapeHtml(s.companyName || "Brianessa Travel | Tu agencia de viajes de confianza");
  const subLine = "Plan de pagos";

  const logoHtml = (s.logoDataUrl && String(s.logoDataUrl).startsWith("data:"))
    ? `<img src="${s.logoDataUrl}" class="pdf-logo-img" alt="logo" />`
    : `<div class="pdf-logo-badge">BT</div>`;

  // Para planes largos (más de 7 pagos):
  // Página 1: Datos del cliente + Modalidad + Calendario
  // Página 2: Bloque de link de pago + Nota + Pie de página
  if(isLongSchedule){
    const page1 = `
    <div class="pdf-page">
      <div class="pdf-header">
        <div class="pdf-header-left">
          ${logoHtml}
          <div class="pdf-headtext">
            <div class="pdf-brand">${brandLine}</div>
            <div class="pdf-subbrand">${subLine}</div>
          </div>
        </div>
        <div class="pdf-meta-top">
          <div class="pdf-date">Fecha: ${escapeHtml(fechaGen)}</div>
        </div>
      </div>

      <div class="pdf-title">${titulo}</div>

      <div class="pdf-body">
        <div class="pdf-intro">
          <b>Estimada, ${escapeHtml(cliente)}:</b><br/>
          Nos complace proporcionarle las opciones de pago personalizadas para completar el monto pendiente de su viaje a ${escapeHtml(viaje)}${extra ? " " + escapeHtml(extra) : ""}. Este documento incluye detalles claros y flexibles para su planificación.
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
              ${kv("Monto Total Original Restante", escapeHtml(toMoney(restante, currency)))}
              ${kv("Monto Pendiente Final", escapeHtml(toMoney(restante, currency)))}
              ${kv("Fecha de Inicio de Pago", escapeHtml(formatDateLongISO(startISO)))}
              ${kv("Fecha Final de Pago", escapeHtml(formatDateLongISO(endISO)))}
            </table>
          </div>

          <div class="pdf-card pay-card">
            <div class="pdf-card-title">Modalidades de Pago Mensual</div>
            <table class="pdf-kv">
              ${kv("Cantidad de Cuotas", escapeHtml(String(cuotas)))}
              ${kv("Monto por Cuota", `${escapeHtml(toMoney(montoCuotaBase, currency))}`)}
            </table>

            <div class="pdf-subtitle" style="margin-top:12px; font-size:13px; font-weight:900;">Calendario de Pagos</div>
            <table class="pdf-table">
              <thead>
                <tr>
                  <th class="pdf-th">Pago</th>
                  <th class="pdf-th">Fecha</th>
                  <th class="pdf-th pdf-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                ${fechasTableRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

    const page2 = `
    <div class="pdf-page">
      <div class="pdf-header pdf-header-compact">
        <div class="pdf-header-left">
          ${logoHtml}
          <div class="pdf-headtext">
            <div class="pdf-brand">${brandLine}</div>
            <div class="pdf-subbrand">${subLine}</div>
          </div>
        </div>
        <div class="pdf-meta-top">
          <div class="pdf-date">Fecha: ${escapeHtml(fechaGen)}</div>
        </div>
      </div>

      <div class="pdf-body">
        <div class="pdf-card pdf-paylink-card">
          <div class="pdf-paylink">
            <div class="pdf-paylink-title">👉 Realiza tus pagos aquí</div>
            <div class="pdf-paylink-url">${escapeHtml(link || "(pendiente de link)")}</div>
          </div>
        </div>

        ${notaTarjeta}
      </div>

      <div class="pdf-footer">
        ${typeof PDF_FOOTER_IMG !== "undefined" && PDF_FOOTER_IMG ? `<img src="${PDF_FOOTER_IMG}" alt="footer" />` : ``}
      </div>
    </div>`;

    return `${page1}${page2}`;
  }

  return `
  <div class="pdf-page">
    <div class="pdf-header">
      <div class="pdf-header-left">
        ${logoHtml}
        <div class="pdf-headtext">
          <div class="pdf-brand">${brandLine}</div>
          <div class="pdf-subbrand">${subLine}</div>
        </div>
      </div>
      <div class="pdf-meta-top">
        <div class="pdf-date">Fecha: ${escapeHtml(fechaGen)}</div>
      </div>
    </div>

    <div class="pdf-title">${titulo}</div>

    <div class="pdf-body">
      <div class="pdf-intro">
        <b>Estimada, ${escapeHtml(cliente)}:</b><br/>
        Nos complace proporcionarle las opciones de pago personalizadas para completar el monto pendiente de su viaje a ${escapeHtml(viaje)}${extra ? " " + escapeHtml(extra) : ""}. Este documento incluye detalles claros y flexibles para su planificación.
      </div>

      <div class="pdf-grid${isLongSchedule ? " onecol" : ""}">
        <div class="pdf-card client-card">
          <div class="pdf-card-title">Datos del Cliente</div>
          <table class="pdf-kv">
            ${kv("Nombre del Cliente", escapeHtml(cliente))}
            ${kv("Viaje", escapeHtml(viaje))}
            ${kv("Monto Total del Viaje", escapeHtml(toMoney(total, currency)))}
            ${kv("Descuento aplicado", escapeHtml(toMoney(descuento, currency)))}
            ${kv("Monto con Descuento", escapeHtml(toMoney(totalDesc, currency)))}
            ${kv("Monto de Reservación", escapeHtml(toMoney(reserva, currency)) + " (ya pagado)")}
            ${kv("Monto Total Original Restante", escapeHtml(toMoney(restante, currency)))}
            ${kv("Monto Pendiente Final", escapeHtml(toMoney(restante, currency)))}
            ${kv("Fecha de Inicio de Pago", escapeHtml(formatDateLongISO(startISO)))}
            ${kv("Fecha Final de Pago", escapeHtml(formatDateLongISO(endISO)))}
          </table>
        </div>

        <div class="pdf-card pay-card">
          <div class="pdf-card-title">Modalidades de Pago Mensual</div>
          <table class="pdf-kv">
            ${kv("Cantidad de Cuotas", escapeHtml(String(cuotas)))}
            ${kv("Monto por Cuota", `${escapeHtml(toMoney(montoCuotaBase, currency))}`)}
          </table>

          <div class="pdf-subtitle" style="margin-top:10px; font-size:13px; font-weight:900;">Fechas de Pago</div>
          <ul class="pdf-list">
            ${fechasListHtml}
          </ul>

          <div class="pdf-paylink">
            <div class="pdf-paylink-title">👉 Realiza tus pagos aquí</div>
            <div class="pdf-paylink-url">${escapeHtml(link || "(pendiente de link)")}</div>
          </div>
        </div>
      </div>

      ${notaTarjeta}
    </div>

    <div class="pdf-footer">
      ${typeof PDF_FOOTER_IMG !== "undefined" && PDF_FOOTER_IMG ? `<img src="${PDF_FOOTER_IMG}" alt="footer" />` : ``}
    </div>
  </div>
  `;
}



function getPdfStylesForDoc(){
  // estilos mínimos para que el HTML quede igual al PDF (sin depender del CSS principal)
  const styleTag = document.getElementById("pdf-inline-styles");
  if(styleTag) return styleTag.textContent || "";
  // fallback: toma estilos del archivo principal si no existe el tag
  return "";
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
<base href="${location.href}">
<link rel="stylesheet" href="styles.css">
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

  // 1) Preferido: HTML -> PDF (con estilo)
  try{
    if(window.html2pdf){
      const root = document.getElementById("pdf-root");
      if(!root){
        toast("Falta el contenedor #pdf-root en el HTML.");
        return;
      }

      root.innerHTML = buildPaymentPlanPdfHTML(p);
      const element = root.firstElementChild;
      if(!element){
        toast("No pude construir el HTML del PDF.");
        return;
      }

      const safeClient = (p.clientName || p.clientDisplay || "plan").toString().trim().replace(/[^\w\-]+/g,"_");
      const safeTrip = (p.tripName || p.tripDisplay || "").toString().trim().replace(/[^\w\-]+/g,"_");
      const filename = `PlanPago_${safeClient}${safeTrip?("_"+safeTrip):""}.pdf`;

      const opt = {
        margin:       [18, 18, 18, 18],
        filename:     filename,
        image:        { type: "jpeg", quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF:        { unit: "pt", format: "a4", orientation: "portrait" },
        pagebreak:    { mode: ["css", "legacy"] }
      };

      // html2pdf puede fallar si el nodo está "limpio" demasiado rápido.
      return html2pdf().set(opt).from(element).save()
        .then(()=>{ root.innerHTML=""; })
        .catch((e)=>{
          console.error("html2pdf error:", e);
          root.innerHTML="";
          toast("No pude generar el PDF. Revisa la consola.");
          // intenta fallback
          return exportPaymentPlanPDF_fallback(p);
        });
    }
  }catch(e){
    console.error("PDF error:", e);
    toast("Error generando PDF. Revisa la consola.");
  }

  // 2) Fallback
  return exportPaymentPlanPDF_fallback(p);
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
        <div class="card col-12"><strong>Logo</strong><div class="kbd">${s.logoDataUrl ? "Cargado ✅" : "Sin logo"}</div></div>
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
      <div class="field">
        <label>Logo (PNG/JPG)</label>
        <input id="sLogo" type="file" accept="image/*" />
        <div class="kbd" style="margin-top:6px;">Se usará en el header del sistema y en los PDFs.</div>
        <div id="sLogoPrev" style="margin-top:10px; display:flex; align-items:center; gap:10px;">
          ${s.logoDataUrl ? `<img src="${s.logoDataUrl}" alt="logo" style="width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid rgba(0,0,0,.08);" />` : `<div class="kbd">Sin logo cargado</div>`}
          ${s.logoDataUrl ? `<button class="btn" type="button" id="sLogoRemove">Quitar</button>` : ``}
        </div>
      </div>

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

      // Commit logo if staged
      if(window.__tmpLogoDataUrl){
        if(window.__tmpLogoDataUrl === "__REMOVE__"){ s.logoDataUrl = ""; }
        else { s.logoDataUrl = window.__tmpLogoDataUrl; }
        window.__tmpLogoDataUrl = "";
      }

      saveState(); closeModal(); render();
    }
  });

  // Handlers logo upload
  const fileEl = document.getElementById("sLogo");
  if(fileEl){
    fileEl.onchange = async (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      const dataUrl = await fileToDataUrl(f, 220, 220); // resize small for storage
      window.__tmpLogoDataUrl = dataUrl;
      const prev = document.getElementById("sLogoPrev");
      if(prev){
        prev.innerHTML = `<img src="${dataUrl}" alt="logo" style="width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid rgba(0,0,0,.08);" />
                          <div class="kbd">Listo para guardar</div>`;
      }
    };
  }
  const rmBtn = document.getElementById("sLogoRemove");
  if(rmBtn){
    rmBtn.onclick = ()=>{
      window.__tmpLogoDataUrl = "__REMOVE__";
      const prev = document.getElementById("sLogoPrev");
      if(prev) prev.innerHTML = `<div class="kbd">Se quitará al guardar</div>`;
    };
  }
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
