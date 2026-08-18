// Cliente minimo para hablar con "api-roturas" (la API propia que reemplaza
// a Supabase, ver /api-roturas en la raiz del proyecto). Reemplaza a
// supabaseClient.js — mismo rol, mismo tipo de uso desde los proveedores.
import { CONFIG, API_LISTO } from '../config.js';

export { API_LISTO };

async function solicitud(ruta, opciones = {}) {
  const { headers: headersExtra, ...resto } = opciones;
  const resp = await fetch(`${CONFIG.apiUrl}${ruta}`, {
    headers: { 'Content-Type': 'application/json', ...headersExtra },
    ...resto,
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

// Sube una evidencia (foto del suceso, foto del conciliador o firma) al
// almacenamiento corporativo y devuelve la ruta relativa que hay que guardar
// en el registro — ver POST /evidencias en api-roturas. "dataUri" es el
// "data:image/...;base64,..." que ya produce la app al tomar la foto/firma;
// aca se convierte a un archivo real para el upload multipart.
export async function subirEvidencia(tipo, dataUri) {
  const blob = await (await fetch(dataUri)).blob();
  const formulario = new FormData();
  formulario.append('archivo', blob, `${tipo}.${blob.type === 'image/png' ? 'png' : 'jpg'}`);
  const resp = await fetch(`${CONFIG.apiUrl}/evidencias?tipo=${tipo}`, { method: 'POST', body: formulario });
  if (!resp.ok) {
    const cuerpo = await resp.json().catch(() => ({}));
    throw new Error(cuerpo.error || `No se pudo subir la evidencia (${tipo}).`);
  }
  const { ruta } = await resp.json();
  return ruta;
}

// URL temporal firmada para mostrar una evidencia puntual (el contenedor es
// privado, nunca se expone una URL publica).
export async function urlEvidencia(rutaRelativa) {
  const { url } = await solicitud(`/evidencias/url?ruta=${encodeURIComponent(rutaRelativa)}`);
  return url;
}

// Tiempo real via Server-Sent Events (ver GET /registros/eventos en
// api-roturas) — equivalente simplificado al canal de Supabase Realtime.
export function suscribirseEventos(ruta, callback) {
  if (!API_LISTO || typeof EventSource === 'undefined') return () => {};
  const fuente = new EventSource(`${CONFIG.apiUrl}${ruta}`);
  fuente.onmessage = () => callback();
  return () => fuente.close();
}
