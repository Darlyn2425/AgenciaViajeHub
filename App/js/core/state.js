const STORAGE_KEY = "bt_hub_v2";

function activeTenantId(source = state) {
    return String(source?.settings?.tenantId || "default").trim() || "default";
}

function assignTenantIfMissing(record, tenantId) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return;
    if (!record.tenantId) record.tenantId = tenantId;
}

function migrateTenantOwnership(targetState) {
    const tenantId = activeTenantId(targetState);
    ["clients", "trips", "paymentPlans", "itineraries", "campaigns", "quotations"].forEach((key) => {
        const list = targetState[key];
        if (!Array.isArray(list)) return;
        list.forEach((row) => assignTenantIfMissing(row, tenantId));
    });
}

function hashPassword(raw) {
    const s = String(raw || "");
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return `h_${(h >>> 0).toString(16)}`;
}

function defaultAuthState() {
    return {
        currentUserId: "",
        apiToken: "",
        apiTokenExp: 0,
        roles: [
            { id: "admin", name: "Administrador", permissions: ["*"] },
            {
                id: "manager", name: "Gerente", permissions: [
                    "dashboard.view",
                    "clients.view", "clients.manage",
                    "trips.view", "trips.manage",
                    "paymentPlans.view", "paymentPlans.manage",
                    "itineraries.view", "itineraries.manage",
                    "quotations.view", "quotations.manage",
                    "campaigns.view", "campaigns.manage",
                    "templates.view", "templates.manage",
                    "ai.view",
                    "settings.view",
                    "profile.manage",
                ]
            },
            {
                id: "sales", name: "Asesor", permissions: [
                    "dashboard.view",
                    "clients.view", "clients.manage",
                    "trips.view", "trips.manage",
                    "paymentPlans.view", "paymentPlans.manage",
                    "itineraries.view", "itineraries.manage",
                    "quotations.view", "quotations.manage",
                    "campaigns.view",
                    "templates.view",
                    "ai.view",
                    "profile.manage",
                ]
            },
            {
                id: "viewer", name: "Lectura", permissions: [
                    "dashboard.view",
                    "clients.view",
                    "trips.view",
                    "paymentPlans.view",
                    "itineraries.view",
                    "quotations.view",
                    "campaigns.view",
                    "templates.view",
                    "ai.view",
                    "profile.manage",
                ]
            }
        ],
        users: [
            {
                id: "usr_admin",
                name: "Administrador",
                username: "admin",
                passwordHash: hashPassword("admin123"),
                roleId: "admin",
                active: true,
                email: "",
                phone: "",
                createdAt: new Date().toISOString(),
                lastLoginAt: ""
            }
        ]
    };
}

function defaultModuleConfigs() {
    return {
        quotations: {
            statuses: [
                { id: "quo_draft", label: "Borrador", color: "#64748b", isFinal: false, isDefault: true, order: 1 },
                { id: "quo_sent", label: "Enviada", color: "#2563eb", isFinal: false, isDefault: false, order: 2 },
                { id: "quo_followup", label: "Seguimiento", color: "#f59e0b", isFinal: false, isDefault: false, order: 3 },
                { id: "quo_approved", label: "Aprobada", color: "#10b981", isFinal: true, isDefault: false, order: 4 },
                { id: "quo_rejected", label: "Rechazada", color: "#ef4444", isFinal: true, isDefault: false, order: 5 },
            ],
            customFields: []
        },
        paymentPlans: {
            statuses: [
                { id: "pay_draft", label: "Borrador", color: "#64748b", isFinal: false, isDefault: true, order: 1 },
                { id: "pay_active", label: "Activo", color: "#10b981", isFinal: false, isDefault: false, order: 2 },
                { id: "pay_paused", label: "Pausado", color: "#f59e0b", isFinal: false, isDefault: false, order: 3 },
                { id: "pay_completed", label: "Completado", color: "#2563eb", isFinal: true, isDefault: false, order: 4 },
                { id: "pay_overdue", label: "Vencido", color: "#ef4444", isFinal: false, isDefault: false, order: 5 },
                { id: "pay_cancelled", label: "Cancelado", color: "#991b1b", isFinal: true, isDefault: false, order: 6 },
            ],
            customFields: []
        }
    };
}

export function seedState() {
    return {
        settings: {
            tenantId: "default",
            companyName: "Brianessa Travel | Tu agencia de viajes de confianza",
            phone: "+1 (954) 294-9969",
            email: "BrianessaTravel@gmail.com",
            instagram: "@brianessa",
            facebook: "Brianessa Travel",
            website: "www.brianessatravelboutique.com",
            cardFeePct: 3.5,
            locale: "es-DO",
            currencyDefault: "USD",
            modules: defaultModuleConfigs()
        },
        clients: [],
        trips: [],
        paymentPlans: [],
        itineraries: [],
        campaigns: [],
        templates: {
            paymentText: [],
            sms: [],
            emailHtml: [],
            disclaimers: [],
        },
        quotations: [],
        auth: defaultAuthState()
    };
}

export let state = seedState();

function isDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:");
}

function sanitizeQuotationForCache(q) {
    if (!q || typeof q !== "object") return q;
    return {
        ...q,
        images: Array.isArray(q.images)
            ? q.images.filter((src) => typeof src === "string" && !isDataUrl(src))
            : [],
        itineraryDays: Array.isArray(q.itineraryDays)
            ? q.itineraryDays.map((day) => ({
                ...day,
                image: isDataUrl(day?.image) ? "" : (day?.image || ""),
            }))
            : [],
    };
}

function sanitizeItineraryForCache(i) {
    if (!i || typeof i !== "object") return i;
    return {
        ...i,
        coverImage: isDataUrl(i.coverImage) ? "" : (i.coverImage || ""),
        galleryImages: Array.isArray(i.galleryImages)
            ? i.galleryImages.filter((src) => typeof src === "string" && !isDataUrl(src))
            : [],
        days: Array.isArray(i.days)
            ? i.days.map((day) => ({
                ...day,
                image: isDataUrl(day?.image) ? "" : (day?.image || ""),
            }))
            : [],
    };
}

function sanitizePaymentPlanForCache(p) {
    if (!p || typeof p !== "object") return p;
    if (!p.attachmentPdf || typeof p.attachmentPdf !== "object") return p;
    return {
        ...p,
        attachmentPdf: {
            ...p.attachmentPdf,
            // Evita guardar PDFs en base64 en localStorage.
            dataUrl: "",
        },
    };
}

function buildPersistableState(source) {
    return {
        ...source,
        quotations: Array.isArray(source.quotations) ? source.quotations.map(sanitizeQuotationForCache) : [],
        itineraries: Array.isArray(source.itineraries) ? source.itineraries.map(sanitizeItineraryForCache) : [],
        paymentPlans: Array.isArray(source.paymentPlans) ? source.paymentPlans.map(sanitizePaymentPlanForCache) : [],
    };
}

export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            state = seedState();
            return state;
        }
        const parsed = JSON.parse(raw);
        const defaultModules = defaultModuleConfigs();
        const parsedModules = parsed.settings?.modules || {};
        const mergedModules = {
            quotations: {
                ...defaultModules.quotations,
                ...(parsedModules.quotations || {}),
                statuses: parsedModules.quotations?.statuses || defaultModules.quotations.statuses,
                customFields: parsedModules.quotations?.customFields || defaultModules.quotations.customFields
            },
            paymentPlans: {
                ...defaultModules.paymentPlans,
                ...(parsedModules.paymentPlans || {}),
                statuses: parsedModules.paymentPlans?.statuses || defaultModules.paymentPlans.statuses,
                customFields: parsedModules.paymentPlans?.customFields || defaultModules.paymentPlans.customFields
            }
        };
        // Merge profundo seguro para settings
        state = {
            ...seedState(),
            ...parsed,
            settings: {
                ...seedState().settings,
                ...(parsed.settings || {}),
                modules: mergedModules
            },
            quotations: parsed.quotations || [], // Asegurar que exista
            auth: {
                ...defaultAuthState(),
                ...(parsed.auth || {}),
                roles: parsed.auth?.roles?.length ? parsed.auth.roles : defaultAuthState().roles,
                users: parsed.auth?.users?.length ? parsed.auth.users : defaultAuthState().users
            }
        };
        migrateTenantOwnership(state);
        return state;
    } catch {
        state = seedState();
        return state;
    }
}

export function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistableState(state)));
    } catch {
        // Fallback extremo: preservar configuración/autenticación y listas básicas.
        const minimal = {
            ...seedState(),
            settings: state.settings || seedState().settings,
            auth: state.auth || seedState().auth,
            clients: Array.isArray(state.clients) ? state.clients : [],
            trips: Array.isArray(state.trips) ? state.trips : [],
            campaigns: Array.isArray(state.campaigns) ? state.campaigns : [],
            templates: state.templates || seedState().templates,
            quotations: [],
            paymentPlans: [],
            itineraries: [],
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
    }
}

export function setState(newState) {
    Object.assign(state, newState);
    saveState();
}

export function refreshTripNames() {
    const tenantId = activeTenantId(state);
    const map = new Map(
        (state.trips || [])
            .filter((t) => {
                assignTenantIfMissing(t, tenantId);
                return t.tenantId === tenantId;
            })
            .map(t => [t.id, t.name])
    );
    (state.clients || []).forEach((c) => {
        assignTenantIfMissing(c, tenantId);
        if (c.tenantId === tenantId) c.tripName = map.get(c.tripId) || "";
    });
    (state.paymentPlans || []).forEach((p) => {
        assignTenantIfMissing(p, tenantId);
        if (p.tenantId === tenantId) p.tripName = map.get(p.tripId) || "";
    });
    (state.itineraries || []).forEach((i) => {
        assignTenantIfMissing(i, tenantId);
        if (i.tenantId === tenantId) i.tripName = map.get(i.tripId) || "";
    });
    // Quotations no usan tripId directamente, pero si lo usaran, iría aquí
}
