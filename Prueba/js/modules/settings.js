import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal } from "../utils/ui.js";
import { escapeHtml, parseNum, fileToDataUrl } from "../utils/helpers.js";

window.openSettingsModal = openSettingsModal;

export function renderSettings() {
    const s = state.settings;
    setContent(`
    <div class="card">
      ${renderModuleToolbar("settings",
        `<div><h2 style="margin:0;">Configuración</h2><div class="kbd">Datos de la agencia + % recargo tarjeta.</div></div>`,
        `<button class="btn primary" onclick="window.openSettingsModal()">Editar</button>`
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

export function openSettingsModal() {
    const s = state.settings;
    openModal({
        title: "Editar configuración",
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
        onSave: () => {
            s.companyName = document.getElementById("sCompany").value.trim() || s.companyName;
            s.phone = document.getElementById("sPhone").value.trim() || s.phone;
            s.email = document.getElementById("sEmail").value.trim() || s.email;
            s.instagram = document.getElementById("sIg").value.trim() || s.instagram;
            s.facebook = document.getElementById("sFb").value.trim() || s.facebook;
            s.website = document.getElementById("sWeb").value.trim() || s.website;
            s.cardFeePct = parseNum(document.getElementById("sFee").value) || s.cardFeePct;

            // Commit logo if staged
            if (window.__tmpLogoDataUrl) {
                if (window.__tmpLogoDataUrl === "__REMOVE__") { s.logoDataUrl = ""; }
                else { s.logoDataUrl = window.__tmpLogoDataUrl; }
                window.__tmpLogoDataUrl = "";
            }

            saveState();
            closeModal();
            if (window.render) window.render();
        }
    });

    // Handlers logo upload
    const fileEl = document.getElementById("sLogo");
    if (fileEl) {
        fileEl.onchange = async (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const dataUrl = await fileToDataUrl(f, 220, 220); // resize small for storage
            window.__tmpLogoDataUrl = dataUrl;
            const prev = document.getElementById("sLogoPrev");
            if (prev) {
                prev.innerHTML = `<img src="${dataUrl}" alt="logo" style="width:48px;height:48px;border-radius:12px;object-fit:cover;border:1px solid rgba(0,0,0,.08);" />
                          <div class="kbd">Listo para guardar</div>`;
            }
        };
    }
    const rmBtn = document.getElementById("sLogoRemove");
    if (rmBtn) {
        rmBtn.onclick = () => {
            window.__tmpLogoDataUrl = "__REMOVE__";
            const prev = document.getElementById("sLogoPrev");
            if (prev) prev.innerHTML = `<div class="kbd">Se quitará al guardar</div>`;
        };
    }
}
