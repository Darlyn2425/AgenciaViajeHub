import { state, saveState } from "./state.js";

const ROUTE_PERMISSION = {
    dashboard: "dashboard.view",
    clients: "clients.view",
    trips: "trips.view",
    "payment-plans": "paymentPlans.view",
    itineraries: "itineraries.view",
    quotations: "quotations.view",
    campaigns: "campaigns.view",
    templates: "templates.view",
    ai: "ai.view",
    settings: "settings.view",
};

function hashPassword(raw) {
    const s = String(raw || "");
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return `h_${(h >>> 0).toString(16)}`;
}

function defaultRoles() {
    return [
        { id: "admin", name: "Administrador", permissions: ["*"] },
        {
            id: "manager",
            name: "Gerente",
            permissions: [
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
            id: "sales",
            name: "Asesor",
            permissions: [
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
            id: "viewer",
            name: "Lectura",
            permissions: [
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
    ];
}

function defaultAdminUser() {
    return {
        id: "usr_admin",
        name: "Administrador",
        username: "admin",
        passwordHash: hashPassword("admin123"),
        roleId: "admin",
        active: true,
        email: "",
        phone: "",
        createdAt: new Date().toISOString(),
        lastLoginAt: "",
    };
}

export function ensureAuthState() {
    if (!state.auth) state.auth = {};
    if (!Array.isArray(state.auth.roles) || !state.auth.roles.length) state.auth.roles = defaultRoles();
    if (!Array.isArray(state.auth.users) || !state.auth.users.length) state.auth.users = [defaultAdminUser()];
    if (typeof state.auth.currentUserId !== "string") state.auth.currentUserId = "";
    if (typeof state.auth.apiToken !== "string") state.auth.apiToken = "";
    if (!Number.isFinite(Number(state.auth.apiTokenExp))) state.auth.apiTokenExp = 0;

    // Migration: plain text password -> hash
    state.auth.users = state.auth.users.map(u => {
        const next = { ...u };
        if (!next.passwordHash && next.password) next.passwordHash = hashPassword(next.password);
        delete next.password;
        if (typeof next.active !== "boolean") next.active = true;
        return next;
    });

    // Hard guard: si por datos viejos no existe admin, lo recreamos automáticamente.
    const adminUser = state.auth.users.find(u => (u.username || "").toLowerCase() === "admin");
    if (!adminUser) {
        state.auth.users.push(defaultAdminUser());
    } else if (!adminUser.active) {
        adminUser.active = true;
    }
}

export function getRoles() {
    ensureAuthState();
    return state.auth.roles || [];
}

export function getUsers() {
    ensureAuthState();
    return state.auth.users || [];
}

export function getRoleById(roleId) {
    ensureAuthState();
    return state.auth.roles.find(r => r.id === roleId) || null;
}

export function getCurrentUser() {
    ensureAuthState();
    const id = state.auth.currentUserId;
    if (!id) return null;
    return state.auth.users.find(u => u.id === id && u.active) || null;
}

export function isAuthenticated() {
    return !!getCurrentUser();
}

export function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user) return false;
    const role = getRoleById(user.roleId);
    if (!role) return false;
    const perms = role.permissions || [];
    return perms.includes("*") || perms.includes(permission);
}

export function canAccessRoute(route) {
    const perm = ROUTE_PERMISSION[route];
    if (!perm) return true;
    return hasPermission(perm);
}

export function getFirstAccessibleRoute() {
    const pref = ["dashboard", "quotations", "payment-plans", "clients", "trips", "itineraries", "campaigns", "templates", "ai", "settings"];
    return pref.find(r => canAccessRoute(r)) || "dashboard";
}

export function login(username, password) {
    ensureAuthState();
    const userKey = String(username || "").trim().toLowerCase();
    const hash = hashPassword(password);
    const user = state.auth.users.find(u => (u.username || "").toLowerCase() === userKey && u.active);
    if (!user) return { ok: false, message: "Usuario no encontrado o inactivo." };
    if (user.passwordHash !== hash) return { ok: false, message: "Contraseña incorrecta." };
    user.lastLoginAt = new Date().toISOString();
    state.auth.currentUserId = user.id;
    saveState();
    return { ok: true, user };
}

export function logout() {
    ensureAuthState();
    state.auth.currentUserId = "";
    state.auth.apiToken = "";
    state.auth.apiTokenExp = 0;
    saveState();
}

export function updateMyProfile(payload = {}) {
    const user = getCurrentUser();
    if (!user) return { ok: false, message: "No hay sesión activa." };
    user.name = (payload.name || user.name || "").trim();
    user.email = (payload.email || "").trim();
    user.phone = (payload.phone || "").trim();
    if (payload.newPassword) user.passwordHash = hashPassword(payload.newPassword);
    saveState();
    return { ok: true };
}

export function upsertUser(payload = {}) {
    ensureAuthState();
    const id = payload.id || "";
    const username = String(payload.username || "").trim().toLowerCase();
    if (!username) return { ok: false, message: "Usuario es obligatorio." };
    if (!payload.roleId) return { ok: false, message: "Rol es obligatorio." };
    const sameUsername = state.auth.users.find(u => (u.username || "").toLowerCase() === username && u.id !== id);
    if (sameUsername) return { ok: false, message: "Ese usuario ya existe." };

    let target = id ? state.auth.users.find(u => u.id === id) : null;
    if (!target) {
        target = {
            id: `usr_${Date.now().toString(36)}`,
            createdAt: new Date().toISOString(),
            lastLoginAt: "",
        };
        state.auth.users.push(target);
    }

    target.name = String(payload.name || "").trim() || target.name || "Usuario";
    target.username = username;
    target.roleId = payload.roleId;
    target.active = payload.active !== false;
    target.email = String(payload.email || "").trim();
    target.phone = String(payload.phone || "").trim();
    if (payload.password) target.passwordHash = hashPassword(payload.password);
    if (!target.passwordHash) target.passwordHash = hashPassword("123456");

    saveState();
    return { ok: true, user: target };
}

export function removeUser(userId) {
    ensureAuthState();
    const user = state.auth.users.find(u => u.id === userId);
    if (!user) return { ok: false, message: "Usuario no encontrado." };
    if (user.id === state.auth.currentUserId) return { ok: false, message: "No puedes eliminar tu propio usuario en sesión." };
    state.auth.users = state.auth.users.filter(u => u.id !== userId);
    saveState();
    return { ok: true };
}

export function resetAccessToDefault() {
    state.auth = {
        currentUserId: "",
        apiToken: "",
        apiTokenExp: 0,
        roles: defaultRoles(),
        users: [defaultAdminUser()]
    };
    saveState();
    return { ok: true, username: "admin" };
}
