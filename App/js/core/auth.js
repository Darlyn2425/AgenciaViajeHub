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

function tenantId() {
    return String(state.settings?.tenantId || "default").trim() || "default";
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

function authHeaders(extra = {}) {
    const token = String(state.auth?.apiToken || "").trim();
    return {
        "x-tenant-id": tenantId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
    };
}

function applySession(data = {}, { persistUsers = false } = {}) {
    ensureAuthState();
    const token = String(data?.token || "").trim();
    const user = data?.user && typeof data.user === "object" ? data.user : null;
    const roles = Array.isArray(data?.roles) ? data.roles : [];
    if (token) {
        state.auth.apiToken = token;
        state.auth.apiTokenExp = decodeJwtExp(token);
    }
    if (user) {
        state.auth.currentUser = user;
        state.auth.currentUserId = String(user.id || "");
    }
    if (roles.length) state.auth.roles = roles;
    if (persistUsers && Array.isArray(data?.users)) state.auth.users = data.users;
    saveState();
}

export function ensureAuthState() {
    if (!state.auth || typeof state.auth !== "object") state.auth = {};
    if (!Array.isArray(state.auth.roles)) state.auth.roles = [];
    if (!Array.isArray(state.auth.users)) state.auth.users = [];
    if (!state.auth.currentUser || typeof state.auth.currentUser !== "object") state.auth.currentUser = null;
    if (typeof state.auth.currentUserId !== "string") state.auth.currentUserId = String(state.auth.currentUser?.id || "");
    if (!state.auth.currentUser && state.auth.currentUserId && Array.isArray(state.auth.users)) {
        const legacy = state.auth.users.find((u) => u?.id === state.auth.currentUserId);
        if (legacy) state.auth.currentUser = legacy;
    }
    if (typeof state.auth.apiToken !== "string") state.auth.apiToken = "";
    if (!Number.isFinite(Number(state.auth.apiTokenExp))) state.auth.apiTokenExp = 0;
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
    return (state.auth.roles || []).find(r => r.id === roleId) || null;
}

export function getCurrentUser() {
    ensureAuthState();
    return state.auth.currentUser || null;
}

export function isAuthenticated() {
    ensureAuthState();
    const user = getCurrentUser();
    if (!user) return false;
    return !!String(state.auth.apiToken || "").trim();
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

export async function login(username, password) {
    ensureAuthState();
    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-tenant-id": tenantId() },
            body: JSON.stringify({
                tenantId: tenantId(),
                username: String(username || "").trim(),
                password: String(password || ""),
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.token || !data?.user) {
            return { ok: false, message: data?.error || "No se pudo iniciar sesión." };
        }
        applySession(data);
        return { ok: true, user: data.user, mustChangePassword: !!data?.user?.mustChangePassword };
    } catch {
        return { ok: false, message: "No se pudo conectar con autenticación." };
    }
}

export async function refreshAuthSession() {
    ensureAuthState();
    if (!state.auth.apiToken) return { ok: false, message: "No hay token" };
    try {
        const response = await fetch("/api/auth/session", {
            method: "GET",
            headers: authHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.token || !data?.user) {
            logout();
            return { ok: false, message: data?.error || "Sesión inválida" };
        }
        applySession(data);
        return { ok: true, user: data.user };
    } catch {
        return { ok: false, message: "No se pudo refrescar sesión." };
    }
}

export function logout() {
    ensureAuthState();
    state.auth.currentUser = null;
    state.auth.currentUserId = "";
    state.auth.apiToken = "";
    state.auth.apiTokenExp = 0;
    state.auth.users = [];
    state.auth.roles = [];
    saveState();
}

export async function updateMyProfile(payload = {}) {
    const user = getCurrentUser();
    if (!user) return { ok: false, message: "No hay sesión activa." };
    try {
        const response = await fetch("/api/auth/profile", {
            method: "PUT",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload || {}),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok || !data?.user) {
            return { ok: false, message: data?.error || "No se pudo actualizar perfil." };
        }
        applySession(data);
        return { ok: true };
    } catch {
        return { ok: false, message: "No se pudo actualizar perfil." };
    }
}

export async function loadUsersAndRoles() {
    try {
        const response = await fetch("/api/auth/users", {
            method: "GET",
            headers: authHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) {
            return { ok: false, message: data?.error || "No se pudieron cargar usuarios." };
        }
        applySession({ users: data.users || [], roles: data.roles || [] }, { persistUsers: true });
        return { ok: true, users: data.users || [], roles: data.roles || [] };
    } catch {
        return { ok: false, message: "No se pudieron cargar usuarios." };
    }
}

export async function upsertUser(payload = {}) {
    try {
        const response = await fetch("/api/auth/users", {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload || {}),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) return { ok: false, message: data?.error || "Error guardando usuario." };
        applySession({ users: data.users || [], roles: data.roles || [] }, { persistUsers: true });
        return { ok: true, user: data.user };
    } catch {
        return { ok: false, message: "Error guardando usuario." };
    }
}

export async function removeUser(userId) {
    const id = String(userId || "").trim();
    if (!id) return { ok: false, message: "Usuario no encontrado." };
    try {
        const response = await fetch(`/api/auth/users?id=${encodeURIComponent(id)}&tenantId=${encodeURIComponent(tenantId())}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) return { ok: false, message: data?.error || "No se pudo eliminar usuario." };
        applySession({ users: data.users || [], roles: data.roles || [] }, { persistUsers: true });
        return { ok: true };
    } catch {
        return { ok: false, message: "No se pudo eliminar usuario." };
    }
}

export async function resetAccessToDefault() {
    try {
        const response = await fetch("/api/auth/reset", {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ tenantId: tenantId() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) return { ok: false, message: data?.error || "No se pudo restablecer acceso." };
        return { ok: true, username: data.username || "admin" };
    } catch {
        return { ok: false, message: "No se pudo restablecer acceso." };
    }
}
