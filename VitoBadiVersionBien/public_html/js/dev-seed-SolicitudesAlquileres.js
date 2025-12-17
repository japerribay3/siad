// js/dev-seed-SolicitudesAlquileres.js
// Semilla para poblar SOLICITUDES + ALQUILERES con un escenario completo.
// Objetivos principales (vista inquilino):
//  - Naroa tiene:
//      * 1 solicitud aceptada con alquiler ACTIVO
//      * 2 solicitudes RECHAZADAS
//      * 1 solicitud PENDIENTE
//  - Hay alquileres activos, histórico y habitaciones sin alquilar.
//  - Hay solicitudes de varios usuarios en diferentes estados.

import {
  openDB,
  getAllRooms,
  createRequest,
  acceptRequest,
  updateRequest,
  finishRental
} from "./db.js";

(async function seedSolicitudesAlquileres() {
  try {
    const FLAG = "vb06_seed_solicitudes_alquileres_v4";
    if (localStorage.getItem(FLAG) === "true") {
      console.log("[seed-SA] Solicitudes/Alquileres ya sembrados (v4). No hago nada.");
      return;
    }

    console.log("[seed-SA] Iniciando semilla de Solicitudes + Alquileres v4…");
    await openDB();

    let rooms = await getAllRooms();
    if (!rooms || rooms.length === 0) {
      console.warn("[seed-SA] No hay habitaciones en la BD. Ejecuta primero los seeds de usuarios y habitaciones.");
      return;
    }

    // Orden estable por fecha de creación
    rooms = rooms.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    // ==== Helpers ====
    async function crearSolicitud(room, email) {
      if (!room) return null;
      try {
        return await createRequest({
          idHabi: room.idHabi,
          emailInquiPosible: email
        });
      } catch (err) {
        console.warn("[seed-SA] No se pudo crear solicitud", email, "para hab", room.direccion, "→", err?.message || err);
        return null;
      }
    }

    function notOwner(room, email) {
      return (room?.emailPropie || "").toLowerCase() !== email.toLowerCase();
    }

    // =============================
    // 1) Seleccionar habitaciones para Naroa
    // =============================
    const emailNaroa = "naroa@gmail.com";
    const roomsForNaroa = rooms.filter(r => notOwner(r, emailNaroa));

    if (roomsForNaroa.length < 4) {
      console.warn("[seed-SA] Hay menos de 4 habitaciones disponibles para Naroa, el escenario se simplificará.");
    }

    const rAcceptNaroa   = roomsForNaroa[0] || null;
    const rRejectNaroa1  = roomsForNaroa[1] || roomsForNaroa[0] || null;
    const rRejectNaroa2  = roomsForNaroa[2] || roomsForNaroa[1] || null;
    const rPendingNaroa  = roomsForNaroa[3] || roomsForNaroa[2] || null;

    // 1.A) Solicitud ACEPTADA de Naroa (alquiler ACTIVO) + otra solicitud rechazada automáticamente
    if (rAcceptNaroa) {
      const solNaroa = await crearSolicitud(rAcceptNaroa, emailNaroa);
      // Competencia
      if (notOwner(rAcceptNaroa, "mikel@gmail.com")) {
        await crearSolicitud(rAcceptNaroa, "mikel@gmail.com");
      }
      if (solNaroa) {
        const alquilerNaroa = await acceptRequest(solNaroa.idSolicitud);
        console.log("[seed-SA] Alquiler ACTIVO para Naroa en", rAcceptNaroa.direccion, alquilerNaroa);
        // El resto de solicitudes pendientes de esta habitación quedan 'rejected' automáticamente.
      }
    }

    // 1.B) Primera solicitud RECHAZADA manualmente de Naroa
    if (rRejectNaroa1 && rRejectNaroa1 !== rAcceptNaroa) {
      let sol = await crearSolicitud(rRejectNaroa1, emailNaroa);
      if (sol) {
        sol.estado = "rejected";
        await updateRequest(sol);
        console.log("[seed-SA] Solicitud RECHAZADA de Naroa en", rRejectNaroa1.direccion);
      }
    }

    // 1.C) Segunda solicitud RECHAZADA de Naroa, en habitación con histórico de alquiler
    if (rRejectNaroa2 && rRejectNaroa2 !== rAcceptNaroa) {
      // Primero creamos un alquiler antiguo para otro usuario, finalizado
      if (notOwner(rRejectNaroa2, "joseba@gmail.com")) {
        const solJoseba = await crearSolicitud(rRejectNaroa2, "joseba@gmail.com");
        if (solJoseba) {
          const alquilerOld = await acceptRequest(solJoseba.idSolicitud);
          const ahora = Date.now();
          const unDia = 24 * 60 * 60 * 1000;
          const hace60dias = ahora - 60 * unDia;
          await finishRental(alquilerOld.idContrato, hace60dias);
          console.log("[seed-SA] Alquiler HISTÓRICO creado en", rRejectNaroa2.direccion, "para Joseba (finalizado).");
        }
      }
      // Ahora creamos la solicitud de Naroa y la marcamos como RECHAZADA
      let sol2 = await crearSolicitud(rRejectNaroa2, emailNaroa);
      if (sol2) {
        sol2.estado = "rejected";
        await updateRequest(sol2);
        console.log("[seed-SA] Segunda solicitud RECHAZADA de Naroa en", rRejectNaroa2.direccion);
      }
    }

    // 1.D) Solicitud PENDIENTE de Naroa
    if (rPendingNaroa && rPendingNaroa !== rAcceptNaroa) {
      const solPend = await crearSolicitud(rPendingNaroa, emailNaroa);
      if (solPend) {
        console.log("[seed-SA] Solicitud PENDIENTE de Naroa en", rPendingNaroa.direccion);
      }
    }

    // =============================
    // 2) Más ejemplos para otros usuarios
    // =============================

    const remainingRooms = rooms.filter(r =>
      r !== rAcceptNaroa &&
      r !== rRejectNaroa1 &&
      r !== rRejectNaroa2 &&
      r !== rPendingNaroa
    );

    const rLucia = remainingRooms[0] || rooms[0];
    const rAnder = remainingRooms[1] || rooms[1];

    // 2.A) Lucía tiene un alquiler ACTIVO en rLucia, con Ander rechazado
    if (rLucia && notOwner(rLucia, "lucia@example.com")) {
      const solLucia = await crearSolicitud(rLucia, "lucia@example.com");
      if (notOwner(rLucia, "ander@example.com")) {
        await crearSolicitud(rLucia, "ander@example.com");
      }
      if (solLucia) {
        const alquLucia = await acceptRequest(solLucia.idSolicitud);
        console.log("[seed-SA] Alquiler ACTIVO para Lucía en", rLucia.direccion, alquLucia);
      }
    }

    // 2.B) Solicitud CANCELADA de Gorka en rAnder
    if (rAnder && notOwner(rAnder, "gorka@example.com")) {
      let solGorka = await crearSolicitud(rAnder, "gorka@example.com");
      if (solGorka) {
        solGorka.estado = "cancelled";
        await updateRequest(solGorka);
        console.log("[seed-SA] Solicitud CANCELADA de Gorka en", rAnder.direccion);
      }
    }

    // =============================
    // 3) Flag final
    // =============================
    localStorage.setItem(FLAG, "true");
    console.log("[seed-SA] Semilla de Solicitudes + Alquileres v4 COMPLETADA ✅");

  } catch (err) {
    console.error("[seed-SA] ERROR global:", err);
  }
})();
