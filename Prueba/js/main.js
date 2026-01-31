import { state, saveState, loadState } from "./core/state.js";
import { setRenderCallback, setContent, icon, toast, initModal, openModal, closeModal, escapeHtml } from "./utils/ui.js";

// Import modules to register window globals and get render functions
import { renderDashboard } from "./modules/dashboard.js";
import { renderClients, openClientModal } from "./modules/clients.js";
import { renderTrips, openTripModal } from "./modules/trips.js";
import { renderPaymentPlans, openPaymentPlanModal } from "./modules/paymentPlans.js";
import { renderItineraries, openItineraryModal } from "./modules/itineraries.js";
import { renderCampaigns } from "./modules/campaigns.js";
import { renderTemplates } from "./modules/templates.js";
import { renderAI } from "./modules/ai.js";
import { renderSettings } from "./modules/settings.js";

let currentRoute = "dashboard";
let searchTerm = "";

// Global render orchestration
function render() {
    // Update active sidebar
    document.querySelectorAll(".nav-item").forEach(el => {
        el.classList.toggle("active", el.dataset.target === currentRoute);
    });

    // Render content based on route
    switch (currentRoute) {
        case "dashboard": renderDashboard(); break;
        case "clients": renderClients(searchTerm); break;
        case "trips": renderTrips(searchTerm); break;
        case "payment-plans": renderPaymentPlans(searchTerm); break;
        case "itineraries": renderItineraries(searchTerm); break;
        case "campaigns": renderCampaigns(); break;
        case "templates": renderTemplates(); break;
        case "ai": renderAI(); break;
        case "settings": renderSettings(); break;
        default: renderDashboard();
    }

    // Update header title
    const titles = {
        dashboard: "Dashboard",
        clients: "Clientes",
        trips: "Viajes / Grupos",
        "payment-plans": "Planes de pago",
        itineraries: "Itinerarios",
        campaigns: "Campañas",
        templates: "Plantillas",
        ai: "Asistente IA",
        settings: "Configuración"
    };
    const titleEl = document.getElementById("headerTitle");
    if (titleEl) titleEl.textContent = titles[currentRoute] || "Brianessa Travel";

    // Re-bind global listeners if needed (search input value)
    const sInput = document.getElementById("searchInput");
    if (sInput && document.activeElement !== sInput) sInput.value = searchTerm;
}

// Navigation
function navigate(route) {
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
window.render = render; // Allow modules to re-render

// Setup UI callbacks
setRenderCallback(render);

// Quick Menu
function openQuickMenu() {
    openModal({
        title: "Nuevo",
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
        onSave: () => closeModal()
    });

    document.getElementById("qPlan").onclick = () => { closeModal(); navigate("payment-plans"); openPaymentPlanModal(); };
    document.getElementById("qIti").onclick = () => { closeModal(); navigate("itineraries"); openItineraryModal(); };
    document.getElementById("qClient").onclick = () => { closeModal(); navigate("clients"); openClientModal(); };
    document.getElementById("qTrip").onclick = () => { closeModal(); navigate("trips"); openTripModal(); };
}
window.openQuickMenu = openQuickMenu;

// Theme handling
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    html.setAttribute("data-theme", isDark ? "light" : "dark");
    localStorage.setItem("brianessa_theme", isDark ? "light" : "dark");
}
window.toggleTheme = toggleTheme;

// Init
document.addEventListener("DOMContentLoaded", () => {
    // Restore theme
    const savedTheme = localStorage.getItem("brianessa_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Bind Sidebar
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.target;
            if (target === "logout") {
                if (confirm("¿Salir?")) location.reload();
            } else {
                navigate(target);
            }
        });
    });

    // Bind Topbar
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

    // Search
    const sInput = document.getElementById("searchInput");
    if (sInput) {
        sInput.addEventListener("input", (e) => {
            searchTerm = e.target.value.toLowerCase();
            render();
        });
    }

    // Quick Menu Button
    const btnQuick = document.getElementById("btnQuick");
    if (btnQuick) btnQuick.onclick = openQuickMenu;

    // Theme Switch
    const btnTheme = document.getElementById("btnTheme");
    if (btnTheme) btnTheme.onclick = toggleTheme;

    // Init Modal listeners
    initModal();

    // Initial Render
    render();
});
