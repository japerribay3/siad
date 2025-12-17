// js/geocode.js
// Geocodificación con Google Geocoding API

const API_KEY = "AIzaSyDj35DCniQwuLv1GHy1puixLXzyRqJ7w_M"; // Mi API_KEY sin restricciones. Cuidado para que los usais

/**
 * Geocodifica una dirección y devuelve { lat, lon } o null si falla
 * @param {string} address Direccion (ej: "C/ San Prudencio 1")
 * @param {string} city Ciudad (ej: "Vitoria-Gasteiz")
 */
export async function geocodeAddress(address, city) {
  const fullAddress = `${address}, ${city}`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[geocode] HTTP error", res.status);
      return null;
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.results || !data.results.length) {
      console.error("[geocode] Geocoding error:", data.status, data.error_message);
      return null;
    }

    const location = data.results[0].geometry.location;
    return {
      lat: location.lat,
      lon: location.lng
    };
  } catch (err) {
    console.error("[geocode] Exception:", err);
    return null;
  }
}
