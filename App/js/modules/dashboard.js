import { state } from "../core/state.js";
import { setContent } from "../utils/ui.js";
import { getTenantItems } from "../utils/tenant-data.js";

export function renderDashboard() {
    const sparkline = (values, stroke) => {
        const width = 120;
        const height = 34;
        const max = Math.max(...values, 1);
        const min = Math.min(...values, 0);
        const range = Math.max(1, max - min);
        const step = width / Math.max(1, values.length - 1);
        const points = values.map((v, i) => {
            const x = Math.round(i * step);
            const y = Math.round(height - ((v - min) / range) * height);
            return `${x},${y}`;
        }).join(" ");
        return `
          <svg class="crm-kpi__spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
          </svg>
        `;
    };

    const money = (value) => {
        const amount = Number(value || 0);
        return new Intl.NumberFormat(state.settings.locale || "es-DO", {
            style: "currency",
            currency: state.settings.currencyDefault || "USD",
            maximumFractionDigits: 2
        }).format(amount);
    };

    const quotations = getTenantItems("quotations");
    const paymentPlans = getTenantItems("paymentPlans");
    const clients = getTenantItems("clients");
    const trips = getTenantItems("trips");
    const quotationsCount = quotations.length;
    const plansCount = paymentPlans.length;
    const clientsCount = clients.length;
    const tripsCount = trips.length;

    const totalQuoted = quotations.reduce((sum, q) => sum + Number(q.total || 0), 0);
    const totalPlanned = paymentPlans.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const totalDeposits = paymentPlans.reduce((sum, p) => sum + Number(p.deposit || 0), 0);
    const pendingCollection = Math.max(0, totalPlanned - totalDeposits);

    const countWithTrip = clients.filter(c => (c.tripName || "").trim()).length;
    const countWithQuotation = clients.filter(c => {
        const cn = (c.name || "").trim().toLowerCase();
        return !!cn && quotations.some(q => ((q.clientName || q.clientDisplay || "").trim().toLowerCase() === cn));
    }).length;
    const countWithPlan = clients.filter(c => {
        const cn = (c.name || "").trim().toLowerCase();
        return !!cn && paymentPlans.some(p => ((p.clientName || p.clientDisplay || "").trim().toLowerCase() === cn));
    }).length;

    const clientsWithoutQuote = Math.max(0, clientsCount - countWithQuotation);
    const clientsWithoutPlan = Math.max(0, clientsCount - countWithPlan);
    const conversionRate = quotationsCount ? Math.round((plansCount / quotationsCount) * 100) : 0;

    const recentQuotations = [...quotations]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5);
    const upcomingPlans = [...paymentPlans]
        .filter(p => p.startDate || p.endDate)
        .sort((a, b) => String(a.startDate || a.endDate).localeCompare(String(b.startDate || b.endDate)))
        .slice(0, 5);

    const todayISO = new Date().toISOString().slice(0, 10);
    const planClientSet = new Set(paymentPlans.map(p => (p.clientName || p.clientDisplay || "").trim().toLowerCase()).filter(Boolean));
    const quoteStatus = (q) => {
        const clientKey = (q.clientName || q.clientDisplay || "").trim().toLowerCase();
        if (clientKey && planClientSet.has(clientKey)) return { label: "Con plan", tone: "ok" };
        return { label: "Pendiente", tone: "warn" };
    };
    const planStatus = (p) => {
        const end = p.endDate || "";
        const start = p.startDate || "";
        if (end && end < todayISO) return { label: "Vencido", tone: "danger" };
        if (start && start > todayISO) return { label: "Próximo", tone: "info" };
        return { label: "Activo", tone: "ok" };
    };

    const pipeline = [
        { label: "Clientes", value: clientsCount, hint: "Base total" },
        { label: "Con viaje", value: countWithTrip, hint: "Asignados a viaje" },
        { label: "Cotizados", value: countWithQuotation, hint: "Con cotización" },
        { label: "Con plan", value: countWithPlan, hint: "Plan de pago activo" }
    ];

    setContent(`
    <section class="crm-dashboard">
      <div class="card crm-hero">
        <div>
          <h2>Dashboard</h2>
          <p>Control operativo de ventas, cotizaciones y cobros en una sola vista.</p>
        </div>
        <div class="crm-hero__actions">
          <button class="btn primary" onclick="window.openQuotationModal()">+ Nueva cotización</button>
          <button class="btn" onclick="window.openPaymentPlanModal()">+ Plan de pago</button>
          <button class="btn" onclick="window.openClientModal()">+ Cliente</button>
        </div>
      </div>

      <div class="crm-kpis">
        <article class="card crm-kpi crm-kpi--1">
          <div class="crm-kpi__label">Monto cotizado</div>
          <div class="crm-kpi__value">${money(totalQuoted)}</div>
          <div class="crm-kpi__meta">${quotationsCount} cotizaciones</div>
          ${sparkline([
            Math.max(1, quotationsCount - 3),
            Math.max(1, quotationsCount - 1),
            quotationsCount,
            quotationsCount + 1,
            quotationsCount + 2
          ], "#3b82f6")}
        </article>
        <article class="card crm-kpi crm-kpi--2">
          <div class="crm-kpi__label">Monto planificado</div>
          <div class="crm-kpi__value">${money(totalPlanned)}</div>
          <div class="crm-kpi__meta">${plansCount} planes activos</div>
          ${sparkline([
            Math.max(1, plansCount - 2),
            Math.max(1, plansCount - 1),
            plansCount,
            plansCount + 1,
            plansCount + 1
          ], "#10b981")}
        </article>
        <article class="card crm-kpi crm-kpi--3">
          <div class="crm-kpi__label">Cobrado (reserva)</div>
          <div class="crm-kpi__value">${money(totalDeposits)}</div>
          <div class="crm-kpi__meta">Pendiente: ${money(pendingCollection)}</div>
          ${sparkline([
            Math.max(1, totalDeposits * 0.55),
            Math.max(1, totalDeposits * 0.68),
            Math.max(1, totalDeposits * 0.73),
            Math.max(1, totalDeposits * 0.82),
            Math.max(1, totalDeposits)
          ], "#f59e0b")}
        </article>
        <article class="card crm-kpi crm-kpi--4">
          <div class="crm-kpi__label">Conversión</div>
          <div class="crm-kpi__value">${conversionRate}%</div>
          <div class="crm-kpi__meta">De cotización a plan</div>
          ${sparkline([
            Math.max(1, conversionRate - 15),
            Math.max(1, conversionRate - 8),
            Math.max(1, conversionRate - 4),
            Math.max(1, conversionRate - 2),
            Math.max(1, conversionRate)
          ], "#8b5cf6")}
        </article>
      </div>

      <div class="crm-main">
        <div class="card crm-pipeline">
          <div class="crm-block__head">
            <h3>Pipeline Operativo</h3>
            <span class="badge">${clientsCount} clientes</span>
          </div>
          <div class="crm-pipeline__grid">
            ${pipeline.map((stage, index) => `
              <div class="crm-stage">
                <div class="crm-stage__idx">${index + 1}</div>
                <div>
                  <div class="crm-stage__label">${stage.label}</div>
                  <div class="crm-stage__value">${stage.value}</div>
                  <div class="crm-stage__hint">${stage.hint}</div>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="crm-pipeline__foot">
            <span>Sin cotización: <strong>${clientsWithoutQuote}</strong></span>
            <span>Sin plan: <strong>${clientsWithoutPlan}</strong></span>
          </div>
        </div>

        <div class="card crm-actions">
          <div class="crm-block__head">
            <h3>Atención del Día</h3>
            <span class="kbd">Prioridades rápidas</span>
          </div>
          <div class="crm-action-list">
            <button class="crm-action" onclick="window.navigate('quotations')">
              <span>Revisar cotizaciones recientes</span>
              <strong>${quotationsCount}</strong>
            </button>
            <button class="crm-action" onclick="window.navigate('payment-plans')">
              <span>Planes y cobros pendientes</span>
              <strong>${plansCount}</strong>
            </button>
            <button class="crm-action" onclick="window.navigate('clients')">
              <span>Clientes por contactar</span>
              <strong>${clientsWithoutQuote}</strong>
            </button>
            <button class="crm-action" onclick="window.navigate('trips')">
              <span>Viajes activos</span>
              <strong>${tripsCount}</strong>
            </button>
          </div>
        </div>
      </div>

      <div class="crm-bottom">
        <div class="card crm-table-card">
          <div class="crm-block__head">
            <h3>Últimas Cotizaciones</h3>
            <button class="btn ghost" onclick="window.navigate('quotations')">Ver todo</button>
          </div>
          <table class="table">
            <thead><tr><th>Cliente</th><th>Destino</th><th>Estado</th><th>Total</th></tr></thead>
            <tbody>
              ${recentQuotations.length ? recentQuotations.map(q => `
                ${(() => {
                    const st = quoteStatus(q);
                    return `
                <tr>
                  <td>${q.clientName || q.clientDisplay || "Cliente"}</td>
                  <td>${q.destination || "Destino"}</td>
                  <td><span class="crm-status crm-status--${st.tone}">${st.label}</span></td>
                  <td>${money(q.total || 0)}</td>
                </tr>
              `;
                })()}
              `).join("") : `<tr><td colspan="4" class="kbd">No hay cotizaciones todavía.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="card crm-table-card">
          <div class="crm-block__head">
            <h3>Planes Próximos</h3>
            <button class="btn ghost" onclick="window.navigate('payment-plans')">Ver todo</button>
          </div>
          <table class="table">
            <thead><tr><th>Cliente</th><th>Inicio</th><th>Estado</th><th>Total</th></tr></thead>
            <tbody>
              ${upcomingPlans.length ? upcomingPlans.map(p => `
                ${(() => {
                    const st = planStatus(p);
                    return `
                <tr>
                  <td>${p.clientName || p.clientDisplay || "Cliente"}</td>
                  <td>${p.startDate || p.endDate || "-"}</td>
                  <td><span class="crm-status crm-status--${st.tone}">${st.label}</span></td>
                  <td>${money(p.total || 0)}</td>
                </tr>
              `;
                })()}
              `).join("") : `<tr><td colspan="4" class="kbd">No hay planes con fecha.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

    </section>
  `);
}
