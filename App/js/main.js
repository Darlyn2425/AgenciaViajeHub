import { state, saveState, loadState } from "./core/state.js";
import { setRenderCallback, setContent, icon, toast, initModal, openModal, closeModal } from "./utils/ui.js";
import { withTenantQuery, tenantHeaders } from "./utils/tenant.js";
import {
    ensureAuthState,
    isAuthenticated,
    login,
    logout,
    getCurrentUser,
    hasPermission,
    canAccessRoute,
    getFirstAccessibleRoute,
    updateMyProfile,
    resetAccessToDefault
} from "./core/auth.js";

// Import modules
import { renderDashboard } from "./modules/dashboard.js";
import { renderClients, openClientModal } from "./modules/clients.js";
import { renderTrips, openTripModal } from "./modules/trips.js";
import { renderPaymentPlans, openPaymentPlanModal } from "./modules/paymentPlans.js";
import { renderItineraries, openItineraryModal } from "./modules/itineraries.js";
import { renderQuotations, openQuotationModal } from "./modules/quotations.js";
import { renderCampaigns } from "./modules/campaigns.js";
import { renderTemplates } from "./modules/templates.js";
import { renderAI } from "./modules/ai.js";
import { renderSettings } from "./modules/settings.js";

let currentRoute = "dashboard";
let searchTerm = "";
let tokenRefreshTimer = null;

const ROUTE_TITLES = {
    dashboard: "Dashboard",
    clients: "Clientes",
    trips: "Viajes / Grupos",
    "payment-plans": "Planes de pago",
    itineraries: "Itinerarios",
    quotations: "Cotizaciones",
    campaigns: "Campañas",
    templates: "Plantillas",
    ai: "Asistente IA",
    settings: "Configuración"
};

async function ensureTenantApiToken({ silent = true } = {}) {
    const user = getCurrentUser();
    if (!user) return "";
    const nowSec = Math.floor(Date.now() / 1000);
    const currentExp = Number(state.auth?.apiTokenExp || 0);
    const currentToken = String(state.auth?.apiToken || "");
    // Reuse token if it still has at least 3 minutes before expiration.
    if (currentToken && currentExp > (nowSec + 180)) return currentToken;
    const tenantId = String(state.settings?.tenantId || "default").trim() || "default";
    if (!tenantId) return "";
    try {
        const response = await fetch("/api/auth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-tenant-id": tenantId,
            },
            body: JSON.stringify({
                tenantId,
                username: user.username || "",
                userId: user.id || "",
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.token) {
            if (!silent) toast(data?.error || "No se pudo obtener token de sesión.");
            return "";
        }
        const token = String(data.token || "");
        state.auth.apiToken = token;
        state.auth.apiTokenExp = decodeJwtExp(token);
        saveState();
        return token;
    } catch {
        if (!silent) toast("No se pudo obtener token de sesión.");
        return "";
    }
}

function decodeJwtExp(token) {
    if (!token || typeof token !== "string") return 0;
    try {
        const parts = token.split(".");
        if (parts.length < 2) return 0;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "===".slice((base64.length + 3) % 4);
        const payload = JSON.parse(atob(padded));
        const exp = Number(payload?.exp || 0);
        return Number.isFinite(exp) ? exp : 0;
    } catch {
        return 0;
    }
}

function stopTokenAutoRefresh() {
    if (!tokenRefreshTimer) return;
    clearInterval(tokenRefreshTimer);
    tokenRefreshTimer = null;
}

function startTokenAutoRefresh() {
    stopTokenAutoRefresh();
    if (!isAuthenticated()) return;
    tokenRefreshTimer = setInterval(() => {
        if (!isAuthenticated()) {
            stopTokenAutoRefresh();
            return;
        }
        ensureTenantApiToken({ silent: true });
    }, 60 * 1000);
}

async function syncSettingsFromApi() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(withTenantQuery("/api/settings"), {
            headers: tenantHeaders(),
            signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.settings || typeof data.settings !== "object") return;
        const before = JSON.stringify(state.settings || {});
        state.settings = {
            ...state.settings,
            ...data.settings,
        };
        const after = JSON.stringify(state.settings || {});
        if (before !== after) {
            saveState();
            // Refresh only if the user is looking at settings.
            if (currentRoute === "settings" && typeof window.render === "function") {
                window.render();
            }
        }
    } catch {
        // keep local settings as fallback
    }
}

function getSearchInputEl() {
    return document.getElementById("globalSearch") || document.getElementById("searchInput");
}

// Global render orchestration
function render() {
    if (!isAuthenticated()) {
        setAppLocked(true);
        renderLoginScreen();
        return;
    }
    setAppLocked(false);
    applyNavPermissions();
    if (!canAccessRoute(currentRoute)) currentRoute = getFirstAccessibleRoute();

    // Update active sidebar
    document.querySelectorAll(".nav-item").forEach(el => {
        el.classList.toggle("active", el.dataset.route === currentRoute);
    });

    // Render content based on route
    switch (currentRoute) {
        case "dashboard": renderDashboard(); break;
        case "clients": renderClients(searchTerm); break;
        case "trips": renderTrips(searchTerm); break;
        case "payment-plans": renderPaymentPlans(searchTerm); break;
        case "itineraries": renderItineraries(searchTerm); break;
        case "quotations": renderQuotations(searchTerm); break;
        case "campaigns": renderCampaigns(); break;
        case "templates": renderTemplates(); break;
        case "ai": renderAI(); break;
        case "settings": renderSettings(); break;
        default: renderDashboard();
    }

    // Update header title
    const titleEl = document.getElementById("headerTitle");
    if (titleEl) titleEl.textContent = ROUTE_TITLES[currentRoute] || "Brianessa Travel";

    // Re-bind global listeners if needed
    const sInput = getSearchInputEl();
    if (sInput && document.activeElement !== sInput) sInput.value = searchTerm;
    updateTopbarUser();
}

// Navigation
function navigate(route) {
    if (!isAuthenticated()) return;
    if (!canAccessRoute(route)) {
        toast("No tienes permisos para acceder a ese módulo.");
        return;
    }
    currentRoute = route;
    searchTerm = ""; // reset search on nav
    render();
    // Close mobile sidebar if open
    if (window.innerWidth <= 768) {
        document.querySelector(".sidebar")?.classList.remove("open");
        document.querySelector(".overlay")?.classList.remove("show");
    }
}

// Expose navigate globally
window.navigate = navigate;
window.render = render;

// Setup UI callbacks
setRenderCallback(render);

// Quick Menu
function openQuickMenu() {
    const canManage = (perm) => hasPermission(perm) || hasPermission("*");
    const canAnyCreate = canManage("paymentPlans.manage") || canManage("itineraries.manage") || canManage("quotations.manage") || canManage("clients.manage") || canManage("trips.manage");
    const makeBtn = (id, txt, cls = "btn") => `<button class="${cls}" id="${id}">${txt}</button>`;
    openModal({
        title: "Nuevo",
        bodyHtml: `
      <div class="card">
        <p>¿Qué quieres crear ahora?</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${canManage("paymentPlans.manage") ? makeBtn("qPlan", "Plan de pago", "btn primary") : ""}
          ${canManage("itineraries.manage") ? makeBtn("qIti", "Itinerario", "btn primary") : ""}
          ${canManage("quotations.manage") ? makeBtn("qQuo", "Cotización", "btn primary") : ""}
          ${canManage("clients.manage") ? makeBtn("qClient", "Cliente", "btn") : ""}
          ${canManage("trips.manage") ? makeBtn("qTrip", "Viaje", "btn") : ""}
        </div>
        ${canAnyCreate ? "" : `<div class="kbd">Tu rol actual no tiene permisos de creación.</div>`}
      </div>
    `,
        onSave: () => closeModal()
    });

    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };
    bind("qPlan", () => { closeModal(); navigate("payment-plans"); openPaymentPlanModal(); });
    bind("qIti", () => { closeModal(); navigate("itineraries"); openItineraryModal(); });
    bind("qQuo", () => { closeModal(); navigate("quotations"); openQuotationModal(); });
    bind("qClient", () => { closeModal(); navigate("clients"); openClientModal(); });
    bind("qTrip", () => { closeModal(); navigate("trips"); openTripModal(); });
}
window.openQuickMenu = openQuickMenu;

// Theme handling
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    const nextTheme = isDark ? "light" : "dark";
    html.setAttribute("data-theme", nextTheme);
    localStorage.setItem("brianessa_theme", nextTheme);
    syncThemeButton(nextTheme);
}
window.toggleTheme = toggleTheme;

function syncThemeButton(theme) {
    const themeSwitch = document.getElementById("themeSwitch");
    if (!themeSwitch) return;
    const isDark = theme === "dark";
    themeSwitch.checked = isDark;
    themeSwitch.setAttribute("aria-checked", isDark ? "true" : "false");
    themeSwitch.setAttribute("title", isDark ? "Modo oscuro activo" : "Modo claro activo");
}

function setAppLocked(locked) {
    document.body.classList.toggle("auth-locked", !!locked);
}

function updateTopbarUser() {
    const badge = document.getElementById("currentUserBadge");
    const btnLogout = document.getElementById("btnLogout");
    const user = getCurrentUser();
    if (!badge || !btnLogout) return;
    if (!user) {
        badge.textContent = "";
        badge.style.display = "none";
        btnLogout.style.display = "none";
        return;
    }
    badge.style.display = "inline-flex";
    btnLogout.style.display = "inline-flex";
    badge.textContent = `${user.name || user.username}`;
}

function renderLoginScreen() {
    setContent(`
      <div class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand">
            <div class="logo">BT</div>
            <div>
              <div class="brand-title">Brianessa Travel</div>
              <div class="brand-sub">Iniciar sesión</div>
            </div>
          </div>
          <div class="form-layout">
            <div class="field">
              <label>Usuario</label>
              <input id="loginUsername" autofocus placeholder="Ej: admin" />
            </div>
            <div class="field">
              <label>Contraseña</label>
              <input id="loginPassword" type="password" placeholder="••••••" />
            </div>
            <button class="btn primary" id="btnLoginSubmit">Entrar</button>
            <div class="kbd">Usuario inicial: <strong>admin</strong> | Clave inicial: <strong>admin123</strong></div>
            <button class="btn ghost" id="btnResetAccess" type="button">Recuperar acceso inicial</button>
            <div id="loginError" class="auth-error" style="display:none;"></div>
          </div>
        </div>
      </div>
    `);

    const submit = async () => {
        const user = (document.getElementById("loginUsername")?.value || "").trim();
        const pass = document.getElementById("loginPassword")?.value || "";
        const result = login(user, pass);
        if (!result.ok) {
            const err = document.getElementById("loginError");
            if (err) {
                err.textContent = result.message || "No se pudo iniciar sesión.";
                err.style.display = "block";
            }
            return;
        }
        await ensureTenantApiToken({ silent: false });
        startTokenAutoRefresh();
        currentRoute = getFirstAccessibleRoute();
        toast(`Bienvenido, ${result.user.name || result.user.username}`);
        render();
    };

    const btn = document.getElementById("btnLoginSubmit");
    if (btn) btn.onclick = () => submit();
    const btnResetAccess = document.getElementById("btnResetAccess");
    if (btnResetAccess) {
        btnResetAccess.onclick = () => {
            const ok = window.confirm("Esto restablecerá usuarios y roles al acceso inicial (admin/admin123). ¿Continuar?");
            if (!ok) return;
            resetAccessToDefault();
            const err = document.getElementById("loginError");
            if (err) {
                err.style.display = "block";
                err.style.color = "var(--ok)";
                err.textContent = "Acceso restablecido. Ingresa con admin / admin123.";
            }
            const userEl = document.getElementById("loginUsername");
            const passEl = document.getElementById("loginPassword");
            if (userEl) userEl.value = "admin";
            if (passEl) passEl.value = "admin123";
        };
    }
    const passwordEl = document.getElementById("loginPassword");
    if (passwordEl) passwordEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
    });
}

function openMyProfile() {
    const user = getCurrentUser();
    if (!user) return;
    openModal({
        title: "Mi perfil",
        bodyHtml: `
          <div class="form-layout">
            <div class="field"><label>Nombre</label><input id="myName" value="${user.name || ""}" /></div>
            <div class="field"><label>Usuario</label><input value="${user.username || ""}" readonly /></div>
            <div class="field"><label>Email</label><input id="myEmail" value="${user.email || ""}" /></div>
            <div class="field"><label>Teléfono</label><input id="myPhone" value="${user.phone || ""}" /></div>
            <div class="field"><label>Nueva contraseña (opcional)</label><input id="myPass" type="password" placeholder="Dejar vacío para no cambiar" /></div>
          </div>
        `,
        onSave: () => {
            const name = document.getElementById("myName").value.trim();
            const email = document.getElementById("myEmail").value.trim();
            const phone = document.getElementById("myPhone").value.trim();
            const newPassword = document.getElementById("myPass").value;
            const res = updateMyProfile({ name, email, phone, newPassword });
            if (!res.ok) { toast(res.message || "No se pudo actualizar perfil."); return; }
            closeModal();
            toast("Perfil actualizado.");
            render();
        }
    });
}

function doLogout() {
    stopTokenAutoRefresh();
    logout();
    setAppLocked(true);
    render();
}

function applyNavPermissions() {
    document.querySelectorAll(".nav-item").forEach(btn => {
        const route = btn.dataset.route;
        if (!route) return;
        const allowed = canAccessRoute(route);
        btn.style.display = allowed ? "" : "none";
    });
}

// Init
document.addEventListener("DOMContentLoaded", () => {
    // 1. Restore theme
    const savedTheme = localStorage.getItem("brianessa_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    syncThemeButton(savedTheme);

    // 2. Load Data State
    loadState();
    ensureAuthState();

    // 3. Bind Sidebar
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.route;
            navigate(target);
        });
    });

    // 4. Bind Topbar
    const btnMenu = document.getElementById("btnMenu");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");

    if (btnMenu) {
        btnMenu.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            overlay.classList.toggle("show");
        });
    }
    if (overlay) {
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("show");
        });
    }

    // 5. Search
    const sInput = getSearchInputEl();
    if (sInput) {
        sInput.addEventListener("input", (e) => {
            searchTerm = e.target.value.toLowerCase();
            render();
        });
    }

    // 6. Global Buttons
    const btnQuick = document.getElementById("btnNewQuick") || document.getElementById("btnQuick");
    if (btnQuick) btnQuick.onclick = openQuickMenu;
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) btnLogout.onclick = doLogout;
    const currentUserBadge = document.getElementById("currentUserBadge");
    if (currentUserBadge) currentUserBadge.onclick = openMyProfile;

    const themeSwitch = document.getElementById("themeSwitch");
    if (themeSwitch) themeSwitch.addEventListener("change", toggleTheme);

    // 7. Init Modal
    initModal();

    // 8. Initial Render
    currentRoute = isAuthenticated() ? (canAccessRoute(currentRoute) ? currentRoute : getFirstAccessibleRoute()) : "dashboard";
    const bootstrapRender = async () => {
        if (isAuthenticated()) {
            await ensureTenantApiToken({ silent: true });
            startTokenAutoRefresh();
        }
        render();
    };
    bootstrapRender();

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        if (!isAuthenticated()) return;
        ensureTenantApiToken({ silent: true });
    });

    // 9. Deferred persistence/sync to avoid blocking first paint.
    setTimeout(() => {
        try { saveState(); } catch { /* ignore */ }
        syncSettingsFromApi();
    }, 0);
});
