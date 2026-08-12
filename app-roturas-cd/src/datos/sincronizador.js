// Punto unico que reintenta la cola de escrituras pendientes (usuarios +
// registros comparten la misma cola en localStorage, ver colaSincronizacion.js).
// Se arranca UNA sola vez desde App.jsx.
import { activarSincronizacionAutomatica, pendientes } from './colaSincronizacion.js';
import { ejecutarOperacionUsuarios } from './usuariosProveedor.js';
import { ejecutarOperacionRegistros } from './registrosProveedor.js';
import { supabase } from './supabaseClient.js';

async function ejecutarOperacion(op) {
  if (op.tabla === 'usuarios') return ejecutarOperacionUsuarios(op);
  if (op.tabla === 'registros') return ejecutarOperacionRegistros(op);
}

export function iniciarSincronizacionGlobal() {
  if (!supabase) return () => {};
  return activarSincronizacionAutomatica(ejecutarOperacion);
}

export { pendientes };
