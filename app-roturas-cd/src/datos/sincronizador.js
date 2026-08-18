// Punto unico que reintenta la cola de escrituras pendientes (usuarios +
// registros comparten la misma cola en localStorage, ver colaSincronizacion.js).
// Se arranca UNA sola vez desde App.jsx.
import { activarSincronizacionAutomatica, pendientes } from './colaSincronizacion.js';
import { ejecutarOperacionUsuarios } from './usuariosProveedor.js';
import { ejecutarOperacionRegistros } from './registrosProveedor.js';
import { supabase } from './supabaseClient.js';
import { API_LISTO } from './apiClient.js';

async function ejecutarOperacion(op) {
  if (op.tabla === 'usuarios') return ejecutarOperacionUsuarios(op);
  if (op.tabla === 'registros') return ejecutarOperacionRegistros(op);
}

// La cola offline debe procesarse siempre que exista un backend real al
// cual escribir — api-roturas (API_LISTO) o, mientras tanto, Supabase. El
// bug corregido aca (ver informe tecnico de Tecnologia): antes esta funcion
// se apagaba por completo si Supabase no estaba configurado, aunque
// API_LISTO estuviera activo — dejaba la cola offline sin sincronizar nunca
// en produccion corporativa (sin Supabase, con la API sí lista).
export function iniciarSincronizacionGlobal() {
  if (!API_LISTO && !supabase) return () => {};
  return activarSincronizacionAutomatica(ejecutarOperacion);
}

export { pendientes };
