/* db.js — VitoBadi IndexedDB + sesión en sessionStorage (key=email)
   v3 estable
*/

const VITO_DB_NAME = "vitobadi06"; // nombre oficial del grupo 06
const VITO_DB_VERSION = 15         // nueva BD => empieza en 1
const SESSION_POINTER_KEY = "vb_session_key";


/* =========================
   Apertura / Migración DB
   ========================= */
export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VITO_DB_NAME, VITO_DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // ===== USUARIO =====
      // PK: id (uuid); índice único por email
      if (!db.objectStoreNames.contains("usuario")) {
        const s = db.createObjectStore("usuario", { keyPath: "id" });
        s.createIndex("email_idx", "email", { unique: true });
      } else {
        const s = req.transaction.objectStore("usuario");
        if (!s.indexNames.contains("email_idx")) {
          s.createIndex("email_idx", "email", { unique: true });
        }
      }

      // ===== HABITACION =====
      // PK: idHabi (uuid)
      if (!db.objectStoreNames.contains("habitacion")) {
        const s = db.createObjectStore("habitacion", { keyPath: "idHabi" });
        s.createIndex("emailPropie_idx", "emailPropie", { unique: false });
        s.createIndex("ciudad_idx", "ciudad", { unique: false });
        s.createIndex("precio_idx", "precio", { unique: false });
      } else {
        const s = req.transaction.objectStore("habitacion");
        if (!s.indexNames.contains("emailPropie_idx"))
          s.createIndex("emailPropie_idx", "emailPropie", { unique: false });
        if (!s.indexNames.contains("ciudad_idx"))
          s.createIndex("ciudad_idx", "ciudad", { unique: false });
        if (!s.indexNames.contains("precio_idx"))
          s.createIndex("precio_idx", "precio", { unique: false });
      }

      // ===== SOLICITUD =====
      // PK: idSolicitud (uuid)
      if (!db.objectStoreNames.contains("solicitud")) {
        const s = db.createObjectStore("solicitud", { keyPath: "idSolicitud" });
        s.createIndex("idHabi_idx", "idHabi", { unique: false });
        s.createIndex("emailInquiPosible_idx", "emailInquiPosible", { unique: false });
        s.createIndex("estado_idx", "estado", { unique: false }); // pending/accepted/rejected/cancelled
      } else {
        const s = req.transaction.objectStore("solicitud");
        if (!s.indexNames.contains("idHabi_idx"))
          s.createIndex("idHabi_idx", "idHabi", { unique: false });
        if (!s.indexNames.contains("emailInquiPosible_idx"))
          s.createIndex("emailInquiPosible_idx", "emailInquiPosible", { unique: false });
        if (!s.indexNames.contains("estado_idx"))
          s.createIndex("estado_idx", "estado", { unique: false });
      }

      // ===== ALQUILER =====
      // PK: idContrato (uuid)
      if (!db.objectStoreNames.contains("alquiler")) {
        const s = db.createObjectStore("alquiler", { keyPath: "idContrato" });
        s.createIndex("idHabi_idx", "idHabi", { unique: false });
        s.createIndex("emailInqui_idx", "emailInqui", { unique: false });
        s.createIndex("activo_idx", "activo", { unique: false }); // true/false
      } else {
        const s = req.transaction.objectStore("alquiler");
        if (!s.indexNames.contains("idHabi_idx"))
          s.createIndex("idHabi_idx", "idHabi", { unique: false });
        if (!s.indexNames.contains("emailInqui_idx"))
          s.createIndex("emailInqui_idx", "emailInqui", { unique: false });
        if (!s.indexNames.contains("activo_idx"))
          s.createIndex("activo_idx", "activo", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txStore(db, store, mode = "readonly") {
  const tx = db.transaction(store, mode);
  return [tx, tx.objectStore(store)];
}

/* =========================
   Utils
   ========================= */
export async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Avatar SVG base64 con iniciales (fallback)
function makeAvatarDataUrl(label) {
  const initials =
    (label || "?").split(/[\s.@_+-]+/).filter(Boolean).slice(0, 2)
      .map(s => s[0]?.toUpperCase()).join("") || "?";
  let hash = 0;
  for (let i = 0; i < (label || "").length; i++) hash = ((hash << 5) - hash) + label.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0%" stop-color="hsl(${hue},70%,55%)"/>
         <stop offset="100%" stop-color="hsl(${(hue+40)%360},70%,45%)"/>
       </linearGradient></defs>
       <rect width="100%" height="100%" rx="16" fill="url(#g)"/>
       <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
             font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
             font-size="40" fill="white">${initials}</text>
     </svg>`;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

/* =========================
   Usuarios
   ========================= */
// === USUARIOS: crear usuario con password en claro ===
export async function createUser({ name = "", email, password, fotoBase64 = "" }) {
  if (!email || !password) throw new Error("Email y contraseña son obligatorios");
  const db = await openDB();

  const existing = await getUserByEmail(email);
  if (existing) throw new Error("Ese email ya está registrado");

  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password,         // ⬅️ se guarda tal cual, SIN cifrar
    fotoBase64,
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "usuario", "readwrite");
    const req = store.add(user);
    req.onsuccess = () => resolve(user);
    req.onerror = () => reject(req.error);
  });
}

export async function getUserByEmail(email) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "usuario");
    const idx = store.index("email_idx");
    const req = idx.get(email.trim().toLowerCase());
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}


// === LOGIN: comprobar email + password en claro ===
export async function verifyLogin(email, password) {
  const user = await getUserByEmail(email);
  if (!user) return null;

  // Comparamos tal cual, sin hash
  if (user.password === password) {
    return user;
  }
  return null;
}

/* =========================
   Sesión en sessionStorage
   - Key   = email
   - Value = { email, name, avatar }
   - vb_session_key = email activo (puntero)
   ========================= */
// === SESIÓN EN sessionStorage (formato enunciado) ===
// SESSION_POINTER_KEY = "vb_session_key" ya lo tienes definido arriba
// ✅ Guardar sesión en Web Storage (sessionStorage)
// key = email, value = JSON con los datos del usuario
export function setSession(user) {
  // Opcional: limpiar sesiones anteriores para que solo haya 1
  sessionStorage.clear();

  const sessionData = {
    email: user.email,
    password: user.password,      // tu profe quiere que esté, aunque sea inseguro
    nombre: user.name,
    foto:  user.fotoBase64 || null,
    // cualquier otro campo que tengas en "usuario"
  };

  sessionStorage.setItem(user.email, JSON.stringify(sessionData));
}

// ✅ Saber si hay alguien logueado
export function isLoggedIn() {
  return sessionStorage.length > 0;
}

// ✅ Obtener la sesión actual como objeto {email, password, nombre, foto, ...}
export function getSession() {
  if (sessionStorage.length === 0) return null;

  // La profe ha dicho "una única tupla", así que asumimos solo 1 entrada
  const key = sessionStorage.key(0);           // primer (y único) email
  const value = sessionStorage.getItem(key);

  try {
    const data = JSON.parse(value);
    // Nos aseguramos de que venga el email
    if (!data.email) data.email = key;
    return data;
  } catch (e) {
    console.error("[db] Error parseando sesión:", e);
    return null;
  }
}

// ✅ Borrar la sesión
export function clearSession() {
  sessionStorage.clear();
}

/* =========================
   Rooms (Habitaciones)
   ========================= */
// ==================== HABITACIONES (HABITACION) ====================
export async function createRoom({ direccion, ciudad, lat, lon, precio, imagenBase64, emailPropie }) {
  if (!direccion || !ciudad || !emailPropie) {
    throw new Error("Faltan campos: direccion / ciudad / propietario");
  }
  if (!(Number(precio) > 0)) {
    throw new Error("El precio debe ser un número mayor que 0");
  }

  const db = await openDB();

  // Comprobamos que el propietario existe en la colección usuario
  const owner = await getUserByEmail(emailPropie);
  if (!owner) {
    throw new Error("El propietario no existe");
  }

  const room = {
    idHabi: crypto.randomUUID(),
    direccion: String(direccion).trim(),
    ciudad: String(ciudad).trim(),
    lat: Number(lat || 0),  // latitud
    lon: Number(lon || 0),  // ⬅️ NUEVA PROPIEDAD: longitud
    precio: Number(precio),
    imagenBase64: String(imagenBase64 || ""),
    emailPropie: emailPropie.trim().toLowerCase(),
    createdAt: Date.now(),
    deletedAt: null
  };

  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "habitacion", "readwrite");
    const req = store.add(room);
    req.onsuccess = () => {
      // Para que el dashboard sepa que este usuario es propietario
      sessionStorage.setItem("vb_has_rooms", "true");
      resolve(room);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getRoomsByOwner(emailPropie) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "habitacion");
    const idx = store.index("emailPropie_idx");
    const req = idx.getAll(emailPropie.trim().toLowerCase());
    req.onsuccess = () => resolve((req.result || []).filter(r => !r.deletedAt));
    req.onerror = () => reject(req.error);
  });
}
/******************** UTILIDADES DE FOTOS ********************/

// Actualizar la foto (base64) de un usuario a partir de su email
export async function updateUserPhoto(email, fotoBase64) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "usuario", "readwrite");
    const idx = store.index("email_idx");
    const req = idx.get(email.trim().toLowerCase());

    req.onsuccess = () => {
      const user = req.result;
      if (!user) {
        console.warn("[updateUserPhoto] Usuario no encontrado:", email);
        resolve(false);
        return;
      }
      user.fotoBase64 = fotoBase64;
      const putReq = store.put(user);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror = () => reject(putReq.error);
    };

    req.onerror = () => reject(req.error);
  });
}

// Poner la misma imagen (base64) a TODAS las habitaciones
export async function updateAllRoomsImage(fotoBase64) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "habitacion", "readwrite");
    const req = store.openCursor();

    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (!cursor) {
        resolve(true);
        return;
      }
      const room = cursor.value;
      room.imagenBase64 = fotoBase64;
      cursor.update(room);
      cursor.continue();
    };

    req.onerror = () => reject(req.error);
  });
}


export async function getRoomById(idHabi) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "habitacion");
    const req = store.get(idHabi);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function softDeleteRoom(idHabi) {
  const db = await openDB();
  const room = await getRoomById(idHabi);
  if (!room) return false;
  room.deletedAt = Date.now();

  await new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "habitacion", "readwrite");
    const req = store.put(room);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });

  const reqs = await getRequestsByRoom(idHabi);
  await Promise.all(reqs.map(r => updateRequest({ ...r, estado: "cancelled" })));

  const active = await getActiveRentalByRoom(idHabi);
  if (active) await finishRental(active.idContrato, Date.now());

  return true;
}
// Devuelve TODAS las habitaciones de la BD (no solo las de un propietario)
export async function getAllRooms() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("habitacion", "readonly");
    const store = tx.objectStore("habitacion");
    const req = store.getAll();

    req.onsuccess = () => {
      resolve(req.result || []);
    };

    req.onerror = () => {
      reject(req.error);
    };
  });
}


/* =========================
   Requests (Solicitudes)
   ========================= */
export async function createRequest({ idHabi, emailInquiPosible }) {
  if (!idHabi || !emailInquiPosible) throw new Error("Faltan campos: idHabi/emailInquiPosible");
  const room = await getRoomById(idHabi);
  if (!room || room.deletedAt) throw new Error("La habitación no existe");

  const email = emailInquiPosible.trim().toLowerCase();
  if (room.emailPropie === email) throw new Error("No puedes solicitar tu propia habitación");

  const existing = await getRequestsByRoomAndUser(idHabi, email);
  if (existing.some(r => r.estado === "pending")) {
    throw new Error("Ya tienes una solicitud pendiente en esta habitación");
  }

  const request = {
    idSolicitud: crypto.randomUUID(),
    idHabi,
    emailInquiPosible: email,
    estado: "pending",
    fechaSolicitud: Date.now(),
    deletedAt: null
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "solicitud", "readwrite");
    const req = store.add(request);
    req.onsuccess = () => resolve(request);
    req.onerror = () => reject(req.error);
  });
}

export async function getRequestsByRoom(idHabi) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "solicitud");
    const idx = store.index("idHabi_idx");
    const req = idx.getAll(idHabi);
    req.onsuccess = () => resolve((req.result || []).filter(r => !r.deletedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function getRequestsByRoomAndUser(idHabi, emailInquiPosible) {
  const all = await getRequestsByRoom(idHabi);
  const email = emailInquiPosible.trim().toLowerCase();
  return all.filter(r => r.emailInquiPosible === email);
}

export async function updateRequest(request) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "solicitud", "readwrite");
    const req = store.put(request);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/* =========================
   Rentals (Alquileres)
   ========================= */
export async function getActiveRentalByRoom(idHabi) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "alquiler");
    const idx = store.index("idHabi_idx");
    const req = idx.getAll(idHabi);
    req.onsuccess = () => {
      const activos = (req.result || []).filter(r => r.activo);
      resolve(activos[0] || null);
    };
    req.onerror = () => reject(req.error);
  });
}
// Devuelve TODOS los alquileres del sistema
export async function getAllRentals() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("alquiler", "readonly"); // nombre del store
    const store = tx.objectStore("alquiler");
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}


export async function acceptRequest(idSolicitud) {
  const db = await openDB();

  const request = await new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "solicitud");
    const req = store.get(idSolicitud);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (!request) throw new Error("Solicitud no encontrada");
  if (request.estado !== "pending") throw new Error("La solicitud no está pendiente");

  const active = await getActiveRentalByRoom(request.idHabi);
  if (active) throw new Error("La habitación ya tiene un alquiler activo");

  const rental = {
    idContrato: crypto.randomUUID(),
    idHabi: request.idHabi,
    emailInqui: request.emailInquiPosible,
    fInicio: Date.now(),
    fFin: null,
    activo: true,
    createdAt: Date.now()
  };
  await new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "alquiler", "readwrite");
    const req = store.add(rental);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });

  request.estado = "accepted";
  await updateRequest(request);

  const siblings = await getRequestsByRoom(request.idHabi);
  await Promise.all(
    siblings
      .filter(r => r.idSolicitud !== idSolicitud && r.estado === "pending")
      .map(r => updateRequest({ ...r, estado: "rejected" }))
  );

  return rental;
}

export async function finishRental(idContrato, fFin = Date.now()) {
  const db = await openDB();
  const rental = await new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "alquiler");
    const req = store.get(idContrato);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (!rental) throw new Error("Contrato no encontrado");

  rental.activo = false;
  rental.fFin = fFin;

  return new Promise((resolve, reject) => {
    const [tx, store] = txStore(db, "alquiler", "readwrite");
    const req = store.put(rental);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}


