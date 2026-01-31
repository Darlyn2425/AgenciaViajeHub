import { setContent, renderModuleToolbar } from "../utils/ui.js";

export function renderCampaigns() {
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
