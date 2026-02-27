const bcrypt = require("bcryptjs");
const { getDb } = require("./mongo");

const AUTH_COLLECTION = process.env.MONGODB_COLLECTION_AUTH || "auth_users";
const BCRYPT_ROUNDS = 10;
let ensuredIndexes = false;

const ROUTE_ROLES = [
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
      "settings.view", "settings.manage",
      "users.view",
      "profile.manage",
    ],
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
    ],
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
    ],
  },
];

function hashPasswordLegacy(raw) {
  const s = String(raw || "");
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `h_${(h >>> 0).toString(16)}`;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || "Usuario",
    username: user.username || "",
    roleId: user.roleId || "viewer",
    active: user.active !== false,
    email: user.email || "",
    phone: user.phone || "",
    createdAt: user.createdAt || "",
    lastLoginAt: user.lastLoginAt || "",
    mustChangePassword: !!user.mustChangePassword,
  };
}

function validatePasswordStrength(raw) {
  const value = String(raw || "");
  if (value.length < 10) return { ok: false, message: "La contraseña debe tener al menos 10 caracteres." };
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return { ok: false, message: "La contraseña debe incluir letras y números." };
  }
  return { ok: true };
}

async function getAuthCollection() {
  const db = await getDb();
  const collection = db.collection(AUTH_COLLECTION);
  if (!ensuredIndexes) {
    try {
      await collection.createIndex({ tenantId: 1 }, { unique: true });
      await collection.createIndex({ tenantId: 1, "users.id": 1 });
      await collection.createIndex({ tenantId: 1, "users.username": 1 });
    } catch (error) {
      if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[auth-store] Index creation warning:", error?.message || error);
      }
    }
    ensuredIndexes = true;
  }
  return collection;
}

async function buildDefaultDoc(tenantId) {
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash("admin123", BCRYPT_ROUNDS);
  return {
    tenantId,
    roles: ROUTE_ROLES,
    users: [
      {
        id: "usr_admin",
        name: "Administrador",
        username: "admin",
        passwordHash,
        roleId: "admin",
        active: true,
        email: "",
        phone: "",
        mustChangePassword: true,
        createdAt: now,
        lastLoginAt: "",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

async function getOrCreateAuthDoc(tenantId) {
  const collection = await getAuthCollection();
  let row = await collection.findOne({ tenantId });
  if (row) return row;
  const doc = await buildDefaultDoc(tenantId);
  try {
    await collection.insertOne(doc);
    row = doc;
  } catch {
    row = await collection.findOne({ tenantId });
  }
  if (!Array.isArray(row.roles) || !row.roles.length) row.roles = ROUTE_ROLES;
  if (!Array.isArray(row.users)) row.users = [];
  return row;
}

function hasPermission(roles, roleId, permission) {
  const role = (roles || []).find((r) => r.id === roleId);
  const perms = role?.permissions || [];
  return perms.includes("*") || perms.includes(permission);
}

async function verifyCredentials(tenantId, usernameRaw, passwordRaw) {
  const username = String(usernameRaw || "").trim().toLowerCase();
  const password = String(passwordRaw || "");
  if (!username || !password) return { ok: false, message: "Usuario y contraseña son obligatorios." };

  const collection = await getAuthCollection();
  const doc = await getOrCreateAuthDoc(tenantId);
  const idx = (doc.users || []).findIndex((u) => String(u.username || "").toLowerCase() === username);
  if (idx < 0) return { ok: false, message: "Usuario no encontrado o inactivo." };

  const user = doc.users[idx];
  if (user.active === false) return { ok: false, message: "Usuario no encontrado o inactivo." };

  let match = false;
  if (String(user.passwordHash || "").startsWith("$2")) {
    match = await bcrypt.compare(password, user.passwordHash);
  } else {
    match = user.passwordHash === hashPasswordLegacy(password);
    if (match) {
      doc.users[idx].passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      doc.users[idx].mustChangePassword = false;
    }
  }
  if (!match) return { ok: false, message: "Contraseña incorrecta." };

  doc.users[idx].lastLoginAt = new Date().toISOString();
  doc.updatedAt = new Date().toISOString();
  await collection.updateOne(
    { tenantId },
    { $set: { users: doc.users, updatedAt: doc.updatedAt } },
    { upsert: true }
  );

  return {
    ok: true,
    user: sanitizeUser(doc.users[idx]),
    roles: doc.roles || ROUTE_ROLES,
  };
}

async function getSession(tenantId, userId) {
  const doc = await getOrCreateAuthDoc(tenantId);
  const user = (doc.users || []).find((u) => u.id === userId && u.active !== false);
  if (!user) return null;
  return {
    user: sanitizeUser(user),
    roles: doc.roles || ROUTE_ROLES,
  };
}

async function listUsers(tenantId) {
  const doc = await getOrCreateAuthDoc(tenantId);
  return {
    users: (doc.users || []).map(sanitizeUser),
    roles: doc.roles || ROUTE_ROLES,
  };
}

async function updateMyProfile(tenantId, userId, payload = {}) {
  const collection = await getAuthCollection();
  const doc = await getOrCreateAuthDoc(tenantId);
  const idx = (doc.users || []).findIndex((u) => u.id === userId && u.active !== false);
  if (idx < 0) return { ok: false, message: "No hay sesión activa." };

  const next = { ...doc.users[idx] };
  if (typeof payload.name === "string") next.name = payload.name.trim() || next.name || "Usuario";
  if (typeof payload.email === "string") next.email = payload.email.trim();
  if (typeof payload.phone === "string") next.phone = payload.phone.trim();
  if (payload.newPassword) {
    const passCheck = validatePasswordStrength(payload.newPassword);
    if (!passCheck.ok) return passCheck;
    next.passwordHash = await bcrypt.hash(String(payload.newPassword), BCRYPT_ROUNDS);
    next.mustChangePassword = false;
  }

  doc.users[idx] = next;
  doc.updatedAt = new Date().toISOString();
  await collection.updateOne({ tenantId }, { $set: { users: doc.users, updatedAt: doc.updatedAt } }, { upsert: true });

  return { ok: true, user: sanitizeUser(next) };
}

async function upsertUser(tenantId, payload = {}, actorUserId = "") {
  const collection = await getAuthCollection();
  const doc = await getOrCreateAuthDoc(tenantId);
  const id = String(payload.id || "").trim();
  const username = String(payload.username || "").trim().toLowerCase();
  if (!username) return { ok: false, message: "Usuario es obligatorio." };
  if (!payload.roleId) return { ok: false, message: "Rol es obligatorio." };

  const duplicate = (doc.users || []).find((u) => String(u.username || "").toLowerCase() === username && u.id !== id);
  if (duplicate) return { ok: false, message: "Ese usuario ya existe." };

  let target = id ? (doc.users || []).find((u) => u.id === id) : null;
  const isCreate = !target;
  if (!target) {
    target = {
      id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      lastLoginAt: "",
    };
    doc.users.push(target);
  }

  if (target.id === actorUserId && payload.active === false) {
    return { ok: false, message: "No puedes desactivar tu propio usuario en sesión." };
  }

  target.name = String(payload.name || "").trim() || target.name || "Usuario";
  target.username = username;
  target.roleId = String(payload.roleId || "viewer");
  target.active = payload.active !== false;
  target.email = String(payload.email || "").trim();
  target.phone = String(payload.phone || "").trim();

  if (payload.password) {
    const passCheck = validatePasswordStrength(payload.password);
    if (!passCheck.ok) return passCheck;
    target.passwordHash = await bcrypt.hash(String(payload.password), BCRYPT_ROUNDS);
    target.mustChangePassword = false;
  }
  if (!target.passwordHash && isCreate) {
    return { ok: false, message: "Debes definir una contraseña inicial segura." };
  }

  doc.updatedAt = new Date().toISOString();
  await collection.updateOne({ tenantId }, { $set: { users: doc.users, updatedAt: doc.updatedAt } }, { upsert: true });
  return { ok: true, user: sanitizeUser(target) };
}

async function deleteUser(tenantId, userId, actorUserId = "") {
  const collection = await getAuthCollection();
  const doc = await getOrCreateAuthDoc(tenantId);
  const target = (doc.users || []).find((u) => u.id === userId);
  if (!target) return { ok: false, message: "Usuario no encontrado." };
  if (target.id === actorUserId) return { ok: false, message: "No puedes eliminar tu propio usuario en sesión." };

  doc.users = (doc.users || []).filter((u) => u.id !== userId);
  doc.updatedAt = new Date().toISOString();
  await collection.updateOne({ tenantId }, { $set: { users: doc.users, updatedAt: doc.updatedAt } }, { upsert: true });
  return { ok: true };
}

async function resetAccess(tenantId) {
  const collection = await getAuthCollection();
  const next = await buildDefaultDoc(tenantId);
  await collection.updateOne(
    { tenantId },
    {
      $set: {
        roles: next.roles,
        users: next.users,
        updatedAt: next.updatedAt,
      },
      $setOnInsert: {
        createdAt: next.createdAt,
      },
    },
    { upsert: true }
  );
  return {
    ok: true,
    username: "admin",
  };
}

async function canManageUsers(tenantId, userId) {
  const session = await getSession(tenantId, userId);
  if (!session?.user) return false;
  return hasPermission(session.roles, session.user.roleId, "users.manage");
}

module.exports = {
  hasPermission,
  verifyCredentials,
  getSession,
  listUsers,
  updateMyProfile,
  upsertUser,
  deleteUser,
  resetAccess,
  canManageUsers,
};
