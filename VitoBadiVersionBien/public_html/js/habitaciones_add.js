// js/habitaciones_add.js
import {
  isLoggedIn,
  getSession,
  clearSession,
  createRoom
} from "./db.js";
import { geocodeAddress } from "./geocode.js";


document.addEventListener("DOMContentLoaded", () => {
  protectPage();
  setupHeaderUser();
  setupImageHandling();
  setupForm();
});

/**
 * Evita que usuarios NO logueados entren en esta página
 */
function protectPage() {
  if (!isLoggedIn()) {
    window.location.replace("login.html");
  }
}

/**
 * Pinta en el header la info del usuario actual (avatar, nombre, logout)
 */
function setupHeaderUser() {
  const loginBox = document.getElementById("loginBox");

  const session = getSession();
  if (!session) {
    loginBox.innerHTML = `<a href="login.html" class="vb-login-btn">Login</a>`;
    return;
  }

  const nombre = session.nombre || session.email;
  const foto = session.foto || session.fotoBase64 || "";

  const avatarHtml = foto
    ? `<img src="${foto}" class="header-user-avatar">`
    : "";

  loginBox.innerHTML = `
    <div class="header-user">
      ${avatarHtml}
      <span>${nombre}</span>
      <button id="logoutBtn" class="vb-login-btn">Logout</button>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    window.location.replace("index.html");
  });
}

/**
 * Maneja:

 - Click en zona
 - Drag & drop
 - Conversión a Base64
 - Previsualización
 */
function setupImageHandling() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("imageInput");
  const previewImg = document.getElementById("previewImg");

  // Click → abrir selector
  dropZone.addEventListener("click", () => fileInput.click());

  // Cuando seleccionas archivo manualmente
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleImageFile(e.target.files[0]);
    }
  });

  // Drag over
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("is-dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-dragover");
  });

  // Drop
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-dragover");

    if (e.dataTransfer.files.length > 0) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  });

  /**
   * Convierte a base64 y muestra preview
   */
  function handleImageFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("El archivo debe ser una imagen.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result; // muestra base64
      previewImg.dataset.base64 = e.target.result; // guardamos base64 aquí
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Gestión del formulario de alta
 */
function setupForm() {
  const form = document.getElementById("roomForm");
  const formErr = document.getElementById("formErr");

    form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formErr.textContent = "";

    const direccion = document.getElementById("address").value.trim();
    const ciudad = document.getElementById("city").value;
    const precio = parseInt(document.getElementById("price").value.trim());
    const previewImg = document.getElementById("previewImg");

    if (!direccion || !ciudad || !precio) {
      formErr.textContent = "Todos los campos son obligatorios.";
      return;
    }

    if (!previewImg.dataset.base64) {
      formErr.textContent = "Debes subir una imagen.";
      return;
    }

    const session = getSession();
    if (!session) {
      formErr.textContent = "Tu sesión ha expirado, vuelve a iniciar sesión.";
      return;
    }

    // 🔵 1) Pedir lat/lon a Google
    formErr.textContent = "Obteniendo coordenadas...";
    const coords = await geocodeAddress(direccion, ciudad);

    if (!coords) {
      formErr.textContent = "No se han podido obtener las coordenadas. Revisa la dirección.";
      return;
    }

    const { lat, lon } = coords;

    // 🔵 2) Construir objeto habitación con lat/lon reales
    const habitacion = {
      direccion,
      ciudad,
      precio,
      lat,
      lon,
      imagenBase64: previewImg.dataset.base64,
      emailPropie: session.email
    };

    try {
      await createRoom(habitacion);
      alert("Habitación añadida correctamente con coordenadas reales.");
      window.location.replace("dashboard.html");
    } catch (err) {
      console.error(err);
      formErr.textContent = "Error al guardar la habitación.";
    }
  });

}
