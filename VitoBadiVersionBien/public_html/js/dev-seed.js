// js/dev-seed.js — Semilla de HABITACIONES (6 en total)
// Cada habitación carga su imagen correspondiente habitacion1.jpg, habitacion2.jpg…
// Si alguna imagen falla, solo ESA habitación usa fallback, no todas.

import { openDB, createRoom, getAllRooms } from "./db.js";

async function imageToBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("404");
    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    console.warn("[seed-rooms] No se pudo cargar", url, "→ usando fallback");
    return "";
  }
}

(async function seedRooms() {
  try {
    const FLAG = "vb06_seed_habitaciones_v3";
    if (localStorage.getItem(FLAG) === "true") {
      console.log("[seed-rooms] Habitaciones ya sembradas (v3).");
      return;
    }

    await openDB();

    const existing = await getAllRooms();
    if (existing.length >= 6) {
      localStorage.setItem(FLAG, "true");
      return;
    }

    console.log("[seed-rooms] Cargando imágenes…");

    // --- 🔥 Carga TODAS las imágenes primero y en orden ---
    const images = await Promise.all([
      imageToBase64("./fotos/habitacion1.jpg"),
      imageToBase64("./fotos/habitacion2.jpg"),
      imageToBase64("./fotos/habitacion3.jpg"),
      imageToBase64("./fotos/habitacion4.jpg"),
      imageToBase64("./fotos/habitacion5.jpg"),
      imageToBase64("./fotos/habitacion6.jpg"),
    ]);

    console.log("[seed-rooms] Imágenes cargadas correctamente.");

    const owners = {
      Joseba: "joseba@gmail.com",
      Ane:    "ane@gmail.com",
      Iker:   "iker@gmail.com",
      Lucía:  "lucia@example.com",
      Ander:  "ander@example.com",
    };

    const rooms = [
      {
        ciudad: "Vitoria-Gasteiz",
        direccion: "C/ San Prudencio 1",
        lat: 42.846,
        lon: -2.672,
        precio: 350,
        prop: "Joseba",
        img: images[0],
      },
      {
        ciudad: "Vitoria-Gasteiz",
        direccion: "C/ Florida 12",
        lat: 42.847,
        lon: -2.671,
        precio: 380,
        prop: "Joseba",
        img: images[1],
      },
      {
        ciudad: "Bilbo",
        direccion: "C/ Licenciado Poza 5",
        lat: 43.263,
        lon: -2.935,
        precio: 420,
        prop: "Iker",
        img: images[2],
      },
      {
        ciudad: "Donosti",
        direccion: "C/ La Concha 3",
        lat: 43.321,
        lon: -1.986,
        precio: 450,
        prop: "Ane",
        img: images[3],
      },
      {
        ciudad: "Vitoria-Gasteiz",
        direccion: "Avda. Gasteiz 50",
        lat: 42.8465,
        lon: -2.689,
        precio: 390,
        prop: "Lucía",
        img: images[4],
      },
      {
        ciudad: "Bilbo",
        direccion: "Gran Vía 20",
        lat: 43.262,
        lon: -2.9355,
        precio: 410,
        prop: "Ander",
        img: images[5],
      },
    ];

    for (const r of rooms) {
      const emailPropie = owners[r.prop];
      if (!emailPropie) continue;

      await createRoom({
        ciudad: r.ciudad,
        direccion: r.direccion,
        lat: r.lat,
        lon: r.lon,
        precio: r.precio,
        emailPropie,
        imagenBase64: r.img ?? "",
      });

      console.log("[seed-rooms] Creada habitación:", r.direccion);
    }

    localStorage.setItem(FLAG, "true");
    console.log("[seed-rooms] Semilla de habitaciones v3 COMPLETADA ✅");

  } catch (err) {
    console.error("[seed-rooms] ERROR:", err);
  }
})();
