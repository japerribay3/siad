// js/login.js
import { getUserByEmail, setSession } from "./db.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errEl = document.getElementById("formErr");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      errEl.textContent = "Email y contraseña obligatorios.";
      return;
    }

    try {
      // 1️⃣ Buscar usuario en IndexedDB
      const user = await getUserByEmail(email);

      if (!user) {
        errEl.textContent = "No existe un usuario con ese email.";
        return;
      }

      // 2️⃣ Verificar contraseña (sin cifrar, como quiere la profe)
      if (user.password !== password) {
        errEl.textContent = "Contraseña incorrecta.";
        return;
      }

      // 3️⃣ Guardar sesión EXACTAMENTE como pide la profesora
      //    key = email
      //    value = JSON con TODOS los datos del usuario
      setSession(user);

      // 4️⃣ Redirigir al dashboard
      window.location.replace("dashboard.html");

    } catch (err) {
      console.error("[login] Error:", err);
      errEl.textContent = "Error al iniciar sesión.";
    }
  });
});
