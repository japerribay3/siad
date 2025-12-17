// js/dev-seed-users.js
// Semilla de usuarios con soporte de imagenes personalizadas.
// Si existe ./fotos/<nombre_en_minusculas>.png -> se usa
// Si no existe -> se usa logo.png como fallback

import { openDB, createUser } from "./db.js";

/**
 * Convierte a Base64 un archivo por URL.
 */
async function fileToBase64(res) {
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Intenta cargar ./fotos/<username>.png
 * Si falla, usa ./fotos/logo.png
 */
async function loadUserAvatar(userName) {
  const file = `./fotos/${userName.toLowerCase()}.png`;

  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error("no existe la foto personalizada");
    return await fileToBase64(res);
  } catch {
    console.warn(`[seed-users] No existe foto personalizada para ${userName}, usando fallback.`);
    // Fallback al logo
    try {
      const fallback = await fetch("./fotos/logo.png");
      if (!fallback.ok) throw new Error("no existe logo.png");
      return await fileToBase64(fallback);
    } catch (err) {
      console.error("[seed-users] ERROR cargando fallback:", err);
      return "";
    }
  }
}

(async function seedUsers() {
  try {
    const FLAG = "vb06_seed_usuarios_v3";
    if (localStorage.getItem(FLAG) === "true") {
      console.log("[seed-users] Usuarios ya sembrados (v3). No hago nada.");
      return;
    }

    console.log("[seed-users] Iniciando semilla de usuarios v3…");
    await openDB();

    const usersData = [
      // Usuarios originales
      { name: "Joseba", email: "joseba@gmail.com", password: "1111" },
      { name: "Ane",    email: "ane@gmail.com",    password: "2222" },
      { name: "Iker",   email: "iker@gmail.com",   password: "3333" },
      { name: "Naroa",  email: "naroa@gmail.com",  password: "4444" },
      { name: "Mikel",  email: "mikel@gmail.com",  password: "5555" },

      // Nuevos usuarios
      { name: "Lucia",  email: "lucia@example.com",  password: "6666" },
      { name: "Ander",  email: "ander@example.com",  password: "7777" },
      { name: "Paula",  email: "paula@example.com",  password: "8888" },
      { name: "Gorka",  email: "gorka@example.com",  password: "9999" },
    ];

    for (const u of usersData) {
      try {
        const avatarBase64 = await loadUserAvatar(u.name);

        const created = await createUser({
          name: u.name,
          email: u.email,
          password: u.password,
          fotoBase64: avatarBase64
        });

        console.log("[seed-users] Usuario creado:", created.email);
      } catch (err) {
        console.warn("[seed-users] No se pudo crear usuario", u.email, "→", err?.message || err);
      }
    }

    localStorage.setItem(FLAG, "true");
    console.log("[seed-users] Semilla de usuarios v3 COMPLETADA ✅");
  } catch (err) {
    console.error("[seed-users] ERROR global:", err);
  }
})();
