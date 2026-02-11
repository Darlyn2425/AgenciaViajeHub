import { state, saveState } from "../core/state.js";
import { setContent, renderModuleToolbar, openModal, closeModal, toast } from "../utils/ui.js";
import { escapeHtml, parseNum, fileToDataUrl } from "../utils/helpers.js";
import { hasPermission, getUsers, getRoles, getCurrentUser, upsertUser, removeUser } from "../core/auth.js";

window.openSettingsModal = openSettingsModal;
window.openStatusManager = openStatusManager;
window.openUsersManager = openUsersManager;

function ensureModuleConfig() {
    if (!state.settings.modules) state.settings.modules = {};
    if (!state.settings.modules.quotations) state.settings.modules.quotations = { statuses: [], customFields: [] };
    if (!state.settings.modules.paymentPlans) state.settings.modules.paymentPlans = { statuses: [], customFields: [] };
    state.settings.modules.quotations.statuses = state.settings.modules.quotations.statuses || [];
    state.settings.modules.paymentPlans.statuses = state.settings.modules.paymentPlans.statuses || [];
}

function getModuleStatuses(moduleKey) {
    ensureModuleConfig();
    return state.settings.modules[moduleKey]?.statuses || [];
}

export function renderSettings() {
    ensureModuleConfig();
    const s = state.settings;
    const users = getUsers();
    const roles = getRoles();
    const canManageSettings = hasPermission("settings.manage") || hasPermission("*");
    const canManageUsers = hasPermission("users.manage") || hasPermission("*");
    const quotationStatuses = getModuleStatuses("quotations");
    const paymentStatuses = getModuleStatuses("paymentPlans");
    setContent(`
    <div class="card">
      ${renderModuleToolbar("settings",
        `<div><h2 style="margin:0;">Configuración</h2><div class="kbd">Datos de la agencia + % recargo tarjeta.</div></div>`,
        `${canManageSettings ? `<button class="btn primary" onclick="window.openSettingsModal()">Editar</button>` : ``}`
    )}
      <hr/>
      <div class="grid">
        <div class="card col-6"><strong>Empresa</strong><div class="kbd">${escapeHtml(s.companyName)}</div></div>
        <div class="card col-6"><strong>Recargo tarjeta</strong><div class="kbd">${escapeHtml(String(s.cardFeePct))}%</div></div>
        <div class="card col-12"><strong>Logo</strong><div class="kbd">${s.logoDataUrl ? "Cargado ✅" : "Sin logo"}</div></div>
        <div class="card col-6">
          <div class="row">
            <div>
              <strong>Estados de Cotizaciones</strong>
              <div class="kbd">${quotationStatuses.length} estados configurados</div>
            </div>
            ${canManageSettings ? `<button class="btn" onclick="window.openStatusManager('quotations')">Gestionar</button>` : `<div class="kbd">Solo lectura</div>`}
          </div>
        </div>
        <div class="card col-6">
          <div class="row">
            <div>
              <strong>Estados de Planes de pago</strong>
              <div class="kbd">${paymentStatuses.length} estados configurados</div>
            </div>
            ${canManageSettings ? `<button class="btn" onclick="window.openStatusManager('paymentPlans')">Gestionar</button>` : `<div class="kbd">Solo lectura</div>`}
          </div>
        </div>
        <div class="card col-12">
          <strong>Campos personalizados (próximamente)</strong>
          <div class="kbd">Se añadirá editor de campos dinámicos por módulo.</div>
        </div>
        <div class="card col-12">
          <div class="row">
            <div>
              <strong>Usuarios y accesos</strong>
              <div class="kbd">${users.length} usuarios · ${roles.length} roles disponibles</div>
            </div>
            ${canManageUsers
            ? `<button class="btn" onclick="window.openUsersManager()">Gestionar usuarios</button>`
            : `<div class="kbd">No tienes permiso para administrar usuarios.</div>`
        }
          </div>
        </div>
      </div>
    </div>
  `);
}

export function openSettingsModal() {
    if (!(hasPermission("settings.manage") || hasPermission("*"))) {
        toast("No tienes permiso para editar configuración.");
        return;
    }
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

export function openStatusManager(moduleKey) {
    if (!(hasPermission("settings.manage") || hasPermission("*"))) {
        toast("No tienes permiso para modificar estados.");
        return;
    }
    ensureModuleConfig();
    const moduleLabel = moduleKey === "quotations" ? "Cotizaciones" : "Planes de pago";
    let statuses = (state.settings.modules[moduleKey].statuses || []).map(st => ({ ...st }));

    const normalizeStatuses = () => {
        statuses = statuses.map((st, idx) => ({
            id: st.id || `${moduleKey}_status_${Date.now()}_${idx}`,
            label: (st.label || "").trim() || `Estado ${idx + 1}`,
            color: st.color || "#64748b",
            isFinal: !!st.isFinal,
            isDefault: !!st.isDefault,
            order: idx + 1
        }));
        if (!statuses.some(st => st.isDefault) && statuses[0]) statuses[0].isDefault = true;
    };

    const renderRows = () => statuses.map((st, idx) => `
      <div class="card" style="padding:10px; margin-bottom:8px;">
        <div class="grid">
          <div class="field col-5">
            <label>Nombre</label>
            <input data-field="label" data-index="${idx}" value="${escapeHtml(st.label || "")}" />
          </div>
          <div class="field col-2">
            <label>Color</label>
            <input type="color" data-field="color" data-index="${idx}" value="${escapeHtml(st.color || "#64748b")}" />
          </div>
          <div class="field col-2">
            <label>Default</label>
            <input type="radio" name="statusDefault" data-field="default" data-index="${idx}" ${st.isDefault ? "checked" : ""} />
          </div>
          <div class="field col-2">
            <label>Final</label>
            <input type="checkbox" data-field="final" data-index="${idx}" ${st.isFinal ? "checked" : ""} />
          </div>
          <div class="field col-1">
            <label>&nbsp;</label>
            <button type="button" class="btn danger full" data-action="remove" data-index="${idx}">✕</button>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn ghost" data-action="up" data-index="${idx}" ${idx === 0 ? "disabled" : ""}>↑ Subir</button>
          <button type="button" class="btn ghost" data-action="down" data-index="${idx}" ${idx === statuses.length - 1 ? "disabled" : ""}>↓ Bajar</button>
        </div>
      </div>
    `).join("");

    const rerender = () => {
        const host = document.getElementById("statusRows");
        if (!host) return;
        normalizeStatuses();
        host.innerHTML = renderRows() || `<div class="kbd">No hay estados. Agrega al menos uno.</div>`;
        bindRowEvents();
    };

    const bindRowEvents = () => {
        const host = document.getElementById("statusRows");
        if (!host) return;

        host.querySelectorAll("[data-action='remove']").forEach(btn => {
            btn.onclick = () => {
                const idx = Number(btn.dataset.index);
                statuses.splice(idx, 1);
                rerender();
            };
        });
        host.querySelectorAll("[data-action='up']").forEach(btn => {
            btn.onclick = () => {
                const idx = Number(btn.dataset.index);
                if (idx > 0) {
                    [statuses[idx - 1], statuses[idx]] = [statuses[idx], statuses[idx - 1]];
                    rerender();
                }
            };
        });
        host.querySelectorAll("[data-action='down']").forEach(btn => {
            btn.onclick = () => {
                const idx = Number(btn.dataset.index);
                if (idx < statuses.length - 1) {
                    [statuses[idx], statuses[idx + 1]] = [statuses[idx + 1], statuses[idx]];
                    rerender();
                }
            };
        });

        host.querySelectorAll("[data-field='label']").forEach(input => {
            input.oninput = () => {
                const idx = Number(input.dataset.index);
                statuses[idx].label = input.value;
            };
        });
        host.querySelectorAll("[data-field='color']").forEach(input => {
            input.oninput = () => {
                const idx = Number(input.dataset.index);
                statuses[idx].color = input.value;
            };
        });
        host.querySelectorAll("[data-field='default']").forEach(input => {
            input.onchange = () => {
                const idx = Number(input.dataset.index);
                statuses = statuses.map((st, i) => ({ ...st, isDefault: i === idx }));
                rerender();
            };
        });
        host.querySelectorAll("[data-field='final']").forEach(input => {
            input.onchange = () => {
                const idx = Number(input.dataset.index);
                statuses[idx].isFinal = input.checked;
            };
        });
    };

    openModal({
        title: `Estados de ${moduleLabel}`,
        bodyHtml: `
      <div class="card">
        <div class="row" style="margin-bottom:10px;">
          <div class="kbd">Configura opciones, color y estado por defecto.</div>
          <button type="button" class="btn primary" id="btnAddStatus">+ Agregar estado</button>
        </div>
        <div id="statusRows"></div>
      </div>
    `,
        onSave: () => {
            normalizeStatuses();
            if (!statuses.length) return;
            state.settings.modules[moduleKey].statuses = statuses;
            saveState();
            closeModal();
            if (window.render) window.render();
        }
    });

    const addBtn = document.getElementById("btnAddStatus");
    if (addBtn) {
        addBtn.onclick = () => {
            statuses.push({
                id: `${moduleKey}_status_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                label: "Nuevo estado",
                color: "#64748b",
                isFinal: false,
                isDefault: statuses.length === 0,
                order: statuses.length + 1
            });
            rerender();
        };
    }

    rerender();
}

export function openUsersManager() {
    if (!(hasPermission("users.manage") || hasPermission("*"))) {
        toast("No tienes permiso para administrar usuarios.");
        return;
    }

    const roles = getRoles();
    const me = getCurrentUser();
    let rows = getUsers().map(u => ({ ...u, _tempPassword: "" }));

    const roleOptions = (roleId) => roles.map(r =>
        `<option value="${escapeHtml(r.id)}" ${r.id === roleId ? "selected" : ""}>${escapeHtml(r.name)}</option>`
    ).join("");

    const renderRows = () => rows.map((u, idx) => `
      <div class="card" style="padding:10px; margin-bottom:8px;">
        <div class="grid">
          <div class="field col-3">
            <label>Nombre</label>
            <input data-field="name" data-index="${idx}" value="${escapeHtml(u.name || "")}" />
          </div>
          <div class="field col-2">
            <label>Usuario</label>
            <input data-field="username" data-index="${idx}" value="${escapeHtml(u.username || "")}" />
          </div>
          <div class="field col-3">
            <label>Rol</label>
            <select data-field="roleId" data-index="${idx}" ${me?.id === u.id ? "disabled" : ""}>
              ${roleOptions(u.roleId)}
            </select>
          </div>
          <div class="field col-2">
            <label>Activo</label>
            <input type="checkbox" data-field="active" data-index="${idx}" ${u.active ? "checked" : ""} ${me?.id === u.id ? "disabled" : ""} />
          </div>
          <div class="field col-2">
            <label>&nbsp;</label>
            <button type="button" class="btn danger full" data-action="remove" data-index="${idx}" ${me?.id === u.id ? "disabled" : ""}>Eliminar</button>
          </div>
        </div>
        <div class="grid">
          <div class="field col-4">
            <label>Nueva contraseña</label>
            <input type="password" data-field="password" data-index="${idx}" placeholder="Solo si deseas cambiarla" />
          </div>
          <div class="field col-4">
            <label>Email</label>
            <input data-field="email" data-index="${idx}" value="${escapeHtml(u.email || "")}" />
          </div>
          <div class="field col-4">
            <label>Teléfono</label>
            <input data-field="phone" data-index="${idx}" value="${escapeHtml(u.phone || "")}" />
          </div>
        </div>
      </div>
    `).join("");

    const rerender = () => {
        const host = document.getElementById("usersRows");
        if (!host) return;
        host.innerHTML = renderRows() || `<div class="kbd">No hay usuarios.</div>`;
        bindEvents();
    };

    const bindEvents = () => {
        const host = document.getElementById("usersRows");
        if (!host) return;

        host.querySelectorAll("[data-action='remove']").forEach(btn => {
            btn.onclick = () => {
                const idx = Number(btn.dataset.index);
                rows.splice(idx, 1);
                rerender();
            };
        });
        host.querySelectorAll("[data-field='name']").forEach(input => {
            input.oninput = () => { rows[Number(input.dataset.index)].name = input.value; };
        });
        host.querySelectorAll("[data-field='username']").forEach(input => {
            input.oninput = () => { rows[Number(input.dataset.index)].username = input.value; };
        });
        host.querySelectorAll("[data-field='roleId']").forEach(select => {
            select.onchange = () => { rows[Number(select.dataset.index)].roleId = select.value; };
        });
        host.querySelectorAll("[data-field='active']").forEach(input => {
            input.onchange = () => { rows[Number(input.dataset.index)].active = input.checked; };
        });
        host.querySelectorAll("[data-field='password']").forEach(input => {
            input.oninput = () => { rows[Number(input.dataset.index)]._tempPassword = input.value; };
        });
        host.querySelectorAll("[data-field='email']").forEach(input => {
            input.oninput = () => { rows[Number(input.dataset.index)].email = input.value; };
        });
        host.querySelectorAll("[data-field='phone']").forEach(input => {
            input.oninput = () => { rows[Number(input.dataset.index)].phone = input.value; };
        });
    };

    openModal({
        title: "Usuarios y roles",
        bodyHtml: `
          <div class="card">
            <div class="row" style="margin-bottom:10px;">
              <div class="kbd">Administra accesos por usuario. Solo perfiles con permiso pueden entrar aquí.</div>
              <button type="button" class="btn primary" id="btnAddUser">+ Agregar usuario</button>
            </div>
            <div id="usersRows"></div>
          </div>
        `,
        onSave: () => {
            const currentIds = new Set(getUsers().map(u => u.id));
            const nextIds = new Set(rows.filter(r => r.id).map(r => r.id));

            // Remove deleted users (except current session; protected in removeUser)
            currentIds.forEach(id => {
                if (!nextIds.has(id)) removeUser(id);
            });

            for (const row of rows) {
                const res = upsertUser({
                    id: row.id,
                    name: row.name,
                    username: row.username,
                    roleId: row.roleId,
                    active: row.active,
                    password: row._tempPassword,
                    email: row.email,
                    phone: row.phone
                });
                if (!res.ok) {
                    toast(res.message || "Error guardando usuarios.");
                    return;
                }
            }

            toast("Usuarios actualizados.");
            closeModal();
            if (window.render) window.render();
        }
    });

    const btnAddUser = document.getElementById("btnAddUser");
    if (btnAddUser) {
        btnAddUser.onclick = () => {
            rows.push({
                id: "",
                name: "Nuevo usuario",
                username: "",
                roleId: roles[0]?.id || "viewer",
                active: true,
                email: "",
                phone: "",
                _tempPassword: "123456"
            });
            rerender();
        };
    }

    rerender();
}
