// Brianessa Travel - Cotización
const $ = (id) => document.getElementById(id);

const binds = {
destino: "fDestino",
  fechaDoc: "fFechaDoc",
  fechas: "fFechas",
  duracion: "fDuracion",
  pasajeros: "fPasajeros",
  moneda: "fMoneda",
  precioPersona: "fPrecioPersona",
  totalGrupo: "fTotalGrupo",
  deposito: "fDeposito",
  notaPrecios: "fNotaPrecios",
  tel: "fTel",
  correo: "fCorreo",
  redes: "fRedes",
  web: "fWeb",
  ninos: "fNinos",
  adultos: "fAdultos",
  precioAdulto: "fPrecioAdulto",
  precioNino: "fPrecioNino",
  depositoPct: "fDepositoPct",
  notaCorta: "fNotaCorta",
};

const lists = {
  transporte: "tTransporte",
  alojamiento: "tAlojamiento",
  traslados: "tTraslados",
  incluye: "tIncluye",
  noIncluye: "tNoIncluye",
  condiciones: "tCondiciones",
};

function num(v){
  const s = (v ?? "").toString().replace(/,/g,"").trim();
  if(!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(amount, currency){
  const prefix = currency === "USD" ? "$" : "RD$";
  return prefix + (amount || 0).toFixed(2);
}

function money(value, currency){

  const v = (value ?? '').toString().trim();
  if(!v) return currency === "USD" ? "$0.00" : "RD$0.00";
  // allow already formatted
  if(/[\$]|RD\$/.test(v)) return v;
  const num = Number(v.replace(/,/g,''));
  if(Number.isNaN(num)) return v;
  const prefix = currency === "USD" ? "$" : "RD$";
  return prefix + num.toFixed(2);
}

function setText(selector, value){
  document.querySelectorAll(`[data-bind="${selector}"]`).forEach(el => el.textContent = value);
}

function setList(listKey, lines){
  const ul = document.querySelector(`[data-list="${listKey}"]`);
  if(!ul) return;
  ul.innerHTML = "";
  lines.filter(Boolean).forEach(line => {
    const li = document.createElement("li");
    li.textContent = line.trim();
    ul.appendChild(li);
  });
}

function readLines(text){
  return (text || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length);
}

function sync(){
  // simple binds
  for(const [bindKey, fieldId] of Object.entries(binds)){
    const el = $(fieldId);
    if(!el) continue;
    let val = el.value;
    if(["precioPersona","totalGrupo","deposito"].includes(bindKey)){
      val = money(val, $("fMoneda").value);
    }
    if(bindKey === "moneda"){
      val = $("fMoneda").value;
    }
    setText(bindKey, val || "");
  }

  // lists
  for(const [listKey, fieldId] of Object.entries(lists)){
    const el = $(fieldId);
    if(!el) continue;
    setList(listKey, readLines(el.value));
  }

  // ensure money binds update when currency changes
  setText("precioPersona", money($("fPrecioPersona").value, $("fMoneda").value));
  setText("totalGrupo", money($("fTotalGrupo").value, $("fMoneda").value));
  setText("deposito", money($("fDeposito").value, $("fMoneda").value));
  setText("moneda", $("fMoneda").value || "USD");

  /* === AUTO-CALC === */
  const currency = $("fMoneda")?.value || "USD";
  const adultos = num($("fAdultos")?.value);
  const ninos = num($("fNinos")?.value);
  const pAdulto = num($("fPrecioAdulto")?.value);
  const pNino = num($("fPrecioNino")?.value);
  const total = (adultos * pAdulto) + (ninos * pNino);
  const pax = adultos + ninos;
  const per = pax > 0 ? (total / pax) : 0;

  if($("fTotalGrupo")) $("fTotalGrupo").value = total ? total.toFixed(2) : "";
  if($("fPrecioPersona")) $("fPrecioPersona").value = per ? per.toFixed(2) : "";

  const pct = num($("fDepositoPct")?.value);
  if(pct > 0){
    const dep = total * (pct/100);
    if($("fDeposito")) $("fDeposito").value = dep.toFixed(2);
  }

  // Nota corta opcional (si la llenas, reemplaza la nota larga impresa)
  const notaCorta = ($("fNotaCorta")?.value || "").trim();
  if(notaCorta){
    setText("notaPrecios", notaCorta);
  }

  // Re-render money after auto calc
  setText("precioPersona", formatMoney(num($("fPrecioPersona").value), currency));
  setText("totalGrupo", formatMoney(num($("fTotalGrupo").value), currency));
  setText("deposito", formatMoney(num($("fDeposito").value), currency));

  // compute pasajeros (si el texto está vacío => adultos/niños)
const manualPas = ($("fPasajeros")?.value || "").trim();
const a = num($("fAdultos")?.value);
const n = num($("fNinos")?.value);

let pasajerosTxt = manualPas;
if(!pasajerosTxt){
  const aTxt = a ? `${a} ${a===1?"adulto":"adultos"}` : "";
  const nTxt = n ? `${n} ${n===1?"niño":"niños"}` : "";
  pasajerosTxt = [aTxt, nTxt].filter(Boolean).join(", ");
}
setText("pasajeros", pasajerosTxt);
}

function getState(){
  const state = {};
  // fields
  Object.values(binds).forEach(id => {
    const el = $(id);
    if(el) state[id] = el.value;
  });
  Object.values(lists).forEach(id => {
    const el = $(id);
    if(el) state[id] = el.value;
  });
  return state;
}

function setState(state){
  for(const [k,v] of Object.entries(state || {})){
    const el = $(k);
    if(el) el.value = v;
  }
  sync();
}

function save(){
  localStorage.setItem("brianessa_cotizacion_v1", JSON.stringify(getState()));
}

function load(){
  const raw = localStorage.getItem("brianessa_cotizacion_v1");
  if(!raw) return;
  try{ setState(JSON.parse(raw)); }catch(e){}
}


// ===== Multi-cotizaciones + WhatsApp =====
const QUOTES_KEY = "brianessa_quotes_v1";

function loadQuotes(){
  try{ return JSON.parse(localStorage.getItem(QUOTES_KEY) || "[]"); }
  catch(e){ return []; }
}
function saveQuotes(arr){ localStorage.setItem(QUOTES_KEY, JSON.stringify(arr || [])); }

function quoteTitle(state){
  const destino = (state.fDestino||"").trim() || "Cotización";
  const fechas = (state.fFechas||"").trim();
  const date = (state.fFechaDoc||"").trim();
  return `${destino}${fechas? " — " + fechas : ""}${date? " ("+date+")":""}`;
}

function renderQuotes(){
  const panel = $("quotesPanel");
  const listEl = $("quotesList");
  if(!panel || !listEl) return;

  const q = ($("qSearch")?.value || "").toLowerCase().trim();
  const quotes = loadQuotes().filter(item => {
    if(!q) return true;
    const blob = (item.title + " " + JSON.stringify(item.state)).toLowerCase();
    return blob.includes(q);
  });

  listEl.innerHTML = "";
  if(!quotes.length){
    listEl.innerHTML = `<div class="muted" style="font-size:12px;">No tienes cotizaciones guardadas.</div>`;
    return;
  }

  quotes.forEach(item => {
    const row = document.createElement("div");
    row.className = "quote-item";
    row.innerHTML = `
      <div class="quote-item__meta">
        <div class="quote-item__title">${item.title}</div>
        <div class="muted">${new Date(item.createdAt).toLocaleString()}</div>
      </div>
      <div class="quote-item__actions">
        <button class="btn btn--ghost" data-act="load" data-id="${item.id}">Cargar</button>
        <button class="btn btn--ghost" data-act="del" data-id="${item.id}">Borrar</button>
        <button class="btn" data-act="json" data-id="${item.id}">JSON</button>
      </div>
    `;
    listEl.appendChild(row);
  });

  listEl.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const all = loadQuotes();
      const item = all.find(x => x.id === id);
      if(!item) return;

      if(act === "load"){
        setState(item.state);
        $("quotesPanel").hidden = true;
      }else if(act === "del"){
        saveQuotes(all.filter(x => x.id !== id));
        renderQuotes();
      }else if(act === "json"){
        const blob = new Blob([JSON.stringify(item.state, null, 2)], {type:"application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (item.title.replace(/[^a-z0-9]+/gi,"_").slice(0,60) || "cotizacion") + ".json";
        a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href), 500);
      }
    });
  });
}

function saveAsQuote(){
  const name = prompt("Nombre para guardar (ej: Hawái - Grupo Junio):", "");
  if(name === null) return;
  const state = getState();
  const all = loadQuotes();
  const id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
  all.unshift({id, title: (name.trim() || quoteTitle(state)), state, createdAt: Date.now()});
  saveQuotes(all);
  alert("Cotización guardada ✅");
}

function copyWhatsApp(){
  const currency = $("fMoneda")?.value || "USD";
  const destino = ($("fDestino")?.value || "").trim();
  const fechas = ($("fFechas")?.value || "").trim();
  const dur = ($("fDuracion")?.value || "").trim();

  const a = num($("fAdultos")?.value);
  const n = num($("fNinos")?.value);
  const pax = [a?`${a} adultos`:"", n?`${n} niños`:""].filter(Boolean).join(", ");

  const total = formatMoney(num($("fTotalGrupo")?.value), currency);
  const dep = formatMoney(num($("fDeposito")?.value), currency);

  const lines = [
    `✈️ *Cotización Brianessa Travel*`,
    destino ? `📍 Destino: *${destino}*` : null,
    fechas ? `🗓️ Fechas: ${fechas}` : null,
    dur ? `🌙 Duración: ${dur}` : null,
    pax ? `👥 Pasajeros: ${pax}` : null,
    `💰 Total grupo: *${total}*`,
    `✅ Depósito para reservar: *${dep}*`,
    `ℹ️ Detalles de hotel/vuelos se entregan al confirmar la reserva.`,
  ].filter(Boolean);

  const text = lines.join("\n");
  (navigator.clipboard?.writeText(text) || Promise.reject())
    .then(()=>alert("Copiado para WhatsApp ✅"))
    .catch(()=>{
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Copiado para WhatsApp ✅");
    });
}


window.addEventListener("DOMContentLoaded", () => {

// ===== Fecha automática si está vacía =====
const hoy = new Date();
const dia = String(hoy.getDate()).padStart(2, "0");
const mes = String(hoy.getMonth() + 1).padStart(2, "0");
const anio = hoy.getFullYear();
const fechaHoy = `${dia}/${mes}/${anio}`;

if(!$("fFechaDoc").value){
  $("fFechaDoc").value = fechaHoy;
}

  // Prefill Hawái (si está vacío)
  if(!$("fDestino").value) $("fDestino").value = "Oahu, Hawái";
  if(!$("fFechas").value) $("fFechas").value = "4 al 8 de junio";
  if(!$("fDuracion").value) $("fDuracion").value = "4 noches";
  if(!$("fAdultos").value) $("fAdultos").value = "6";
  if(!$("fNinos").value) $("fNinos").value = "1";
  // si quieres texto manual, puedes llenarlo; si no, se calcula
  if(!$("fPasajeros").value) $("fPasajeros").value = "";
  if(!$("fPrecioAdulto").value) $("fPrecioAdulto").value = "";
  if(!$("fPrecioNino").value) $("fPrecioNino").value = "";
  if(!$("fDepositoPct").value) $("fDepositoPct").value = "";
  // Defaults
  const today = new Date();
  const dd = String(today.getDate()).padStart(2,"0");
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const yyyy = today.getFullYear();
  if(!$("fFechaDoc").value) $("fFechaDoc").value = `${dd}/${mm}/${yyyy}`;

  // sample footer defaults
  if(!$("fTel").value) $("fTel").value = "+1 (954) 294-9969";
  if(!$("fCorreo").value) $("fCorreo").value = "BrianessaTravel@gmail.com";
  if(!$("fRedes").value) $("fRedes").value = "Instagram: @brianessa  Facebook: Brianessa Travel";
  if(!$("fWeb").value) $("fWeb").value = "www.brianessatravelboutique.com";

  load();
  sync();

  // listeners
  document.querySelectorAll("input, textarea, select").forEach(el => {
    el.addEventListener("input", sync);
    el.addEventListener("change", sync);
  });

  $("btnSave").addEventListener("click", () => { save(); alert("Guardado."); });
  $("btnLoad").addEventListener("click", () => { load(); alert("Cargado."); });
  $("btnSaveAs")?.addEventListener("click", () => { save(); saveAsQuote(); });
  $("btnQuotes")?.addEventListener("click", () => { const p=$("quotesPanel"); p.hidden=!p.hidden; renderQuotes(); });
  $("btnWhatsApp")?.addEventListener("click", () => { save(); copyWhatsApp(); });
  $("qSearch")?.addEventListener("input", renderQuotes);
  $("btnNew")?.addEventListener("click", () => { localStorage.removeItem("brianessa_cotizacion_v1"); location.reload(); });
  $("btnPrint").addEventListener("click", () => { save(); window.print(); });
  
});
