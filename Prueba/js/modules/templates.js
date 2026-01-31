import { setContent, renderModuleToolbar } from "../utils/ui.js";

export function renderTemplates() {
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
