// Cliente minimo para hablar con "api-roturas" (la API propia que reemplaza
// a Supabase, ver /api-roturas en la raiz del proyecto). Reemplaza a
// supabaseClient.js — mismo rol, mismo tipo de uso desde los proveedores.
import { CONFIG, API_LISTO } from '../config.js';

export { API_LISTO };

async function solicitud(ruta, opciones = {}) {
  const resp = await fetch(`${CONFIG.apiUrl}${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  if (!resp.ok) {
    const cuerpo = await resp.json().catch(() => ({}));
    throw new Error(cuerpo.error || `api-roturas respondio ${resp.status}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export const api = {
  get: (ruta) => solicitud(ruta),
  post: (ruta, datos) => solicitud(ruta, { method: 'POST', body: JSON.stringify(datos) }),
  patch: (ruta, datos) => solicitud(ruta, { method: 'PATCH', body: JSON.stringify(datos) }),
  del: (ruta) => solicitud(ruta, { method: 'DELETE' }),
};

// Tiempo real via Server-Sent Events (ver GET /registros/eventos en
// api-roturas) — equivalente simplificado al canal de Supabase Realtime.
export function suscribirseEventos(ruta, callback) {
  if (!API_LISTO || typeof EventSource === 'undefined') return () => {};
  const fuente = new EventSource(`${CONFIG.apiUrl}${ruta}`);
  fuente.onmessage = () => callback();
  return () => fuente.close();
}
