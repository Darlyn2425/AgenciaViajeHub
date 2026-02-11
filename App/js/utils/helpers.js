import { state } from "../core/state.js";

export function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function matchesSearch(obj, term) {
    if (!term) return true;
    return JSON.stringify(obj).toLowerCase().includes(term);
}

export async function fileToDataUrl(file, maxW = 300, maxH = 300) {
    const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });

    return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width, h = img.height;
            const scale = Math.min(1, maxW / w, maxH / h);
            const nw = Math.max(1, Math.round(w * scale));
            const nh = Math.max(1, Math.round(h * scale));
            const c = document.createElement("canvas");
            c.width = nw; c.height = nh;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0, nw, nh);
            resolve(c.toDataURL("image/png", 0.92));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

export function escapeHtml(s = "") {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function escapeAttr(s = "") {
    return String(s || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "")
        .replaceAll(">", "")
        .replaceAll('"', "")
        .replaceAll("'", "");
}

export function toMoney(n, currency) {
    const v = Number(n || 0);
    const c = currency || state.settings.currencyDefault;
    return new Intl.NumberFormat(state.settings.locale, { style: "currency", currency: c }).format(v);
}

export function round2(n) {
    return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

export function parseNum(v) {
    return Number(String(v || "").replace(/[^0-9.-]/g, "")) || 0;
}

export function formatDateLongISO(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(state.settings.locale, { day: "numeric", month: "long", year: "numeric" });
}

export function ordinalPago(i) {
    const n = i + 1;
    const ordinals = ["1er", "2do", "3er", "4to", "5to", "6to", "7mo", "8vo", "9no"];
    return ordinals[i] || `${n}°`;
}

export function buildScheduleDates({ startISO, endISO, frequency }) {
    const start = new Date(startISO + "T00:00:00");
    const end = new Date(endISO + "T00:00:00");
    const dates = [];

    if (!startISO || !endISO || isNaN(start) || isNaN(end) || start > end) return dates;

    const daysInMonth = (y, m0) => new Date(y, m0 + 1, 0).getDate();

    if (frequency === "Mensual") {
        const targetDay = start.getDate();
        let y = start.getFullYear();
        let m0 = start.getMonth();

        while (true) {
            const dim = daysInMonth(y, m0);
            const day = Math.min(targetDay, dim);
            const cur = new Date(y, m0, day);

            if (cur < start) {
                m0 += 1;
                if (m0 > 11) { m0 = 0; y += 1; }
                continue;
            }
            if (cur > end) break;

            dates.push(cur);

            m0 += 1;
            if (m0 > 11) { m0 = 0; y += 1; }
        }
    } else {
        // Quincenal
        const cur = new Date(start);
        while (cur <= end) {
            dates.push(new Date(cur));
            cur.setDate(cur.getDate() + 15);
        }
    }

    return dates.map(d => d.toISOString().slice(0, 10));
}

export function splitInstallments(total, n) {
    const base = Math.floor((total / n) * 100) / 100;
    const arr = Array.from({ length: n }, () => base);
    const sumBase = round2(base * n);
    const diff = round2(total - sumBase);
    arr[n - 1] = round2(arr[n - 1] + diff);
    return arr;
}
