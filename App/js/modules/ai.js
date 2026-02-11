import { setContent, renderModuleToolbar } from "../utils/ui.js";

export function renderAI() {
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

    const btnSample = document.getElementById("aiSample");
    if (btnSample) {
        btnSample.onclick = () => {
            document.getElementById("aiPrompt").value =
                `Eres asistente de Brianessa Travel.
Crea un plan de pago en el formato oficial (encabezado, datos, cuotas, nota tarjeta).
Datos: total 3797, descuento 300, reserva 250, inicio 2026-02-16, fin 2026-09-30, frecuencia Mensual, forma Tarjeta, link: ...`;
        };
    }

    const btnSend = document.getElementById("aiSend");
    if (btnSend) {
        btnSend.onclick = async () => {
            const prompt = document.getElementById("aiPrompt").value.trim();
            if (!prompt) return;
            const out = document.getElementById("aiResp");
            out.value = "Procesando...";
            try {
                const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
                const data = await r.json();
                out.value = data.text || JSON.stringify(data, null, 2);
            } catch {
                out.value = "No se pudo conectar a /api/chat (luego montamos el endpoint).";
            }
        };
    }

    const btnCopy = document.getElementById("aiCopy");
    if (btnCopy) {
        btnCopy.onclick = () => navigator.clipboard.writeText(document.getElementById("aiResp").value || "");
    }
}
