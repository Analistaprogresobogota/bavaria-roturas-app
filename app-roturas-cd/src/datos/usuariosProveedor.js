// Login y administracion de cuentas (tabla "usuarios").
// El login funciona offline: si no hay red, se valida contra la ultima
// copia de "usuarios" que quedo en cache (de la ultima vez que hubo señal).
//
// Backend: usa api-roturas (VITE_API_URL) si esta configurada, si no cae a
// Supabase (comportamiento original), si no trabaja solo con cache local —
// mismo criterio que registrosProveedor.js.
import { supabase } from './supabaseClient.js';
import { api, API_LISTO } from './apiClient.js';
import { leerCache, escribirCache, encolar } from './colaSincronizacion.js';

const TABLA = 'usuarios';

function normaliza(u) {
  return (u || '').trim().toLowerCase();
}

export async function listarUsuarios() {
  if (API_LISTO) {
    try {
      const data = await api.get('/usuarios');
      escribirCache(TABLA, data);
      return data;
    } catch {
      return leerCache(TABLA);
    }
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.from(TABLA).select('*').order('nombre');
      if (error) throw error;
      escribirCache(TABLA, data);
      return data;
    } catch {
      return leerCache(TABLA);
    }
  }
  return leerCache(TABLA);
}

export async function login(usuario, password) {
  const u = normaliza(usuario);

  if (API_LISTO) {
    try {
      // La validacion pasa por el servidor: a diferencia de Supabase, aqui
      // nunca se trae la lista completa de contraseñas al dispositivo.
      const encontrado = await api.post('/usuarios/login', { usuario: u, password });
      return encontrado || null;
    } catch {
      // sin red: seguir con la cache de abajo
    }
  } else if (supabase) {
    try {
      const { data, error } = await supabase.from(TABLA).select('*').eq('activo', true);
      if (error) throw error;
      escribirCache(TABLA, data);
      const encontrado = data.find((x) => normaliza(x.usuario) === u && x.password === password);
      return encontrado || null;
    } catch {
      // sin red: seguir con la cache de abajo
    }
  }

  const cache = leerCache(TABLA);
  const encontrado = cache.find((x) => normaliza(x.usuario) === u && x.password === password && x.activo !== false);
  return encontrado || null;
}

export async function crearUsuario(datos) {
  const registro = { nombre: datos.nombre, usuario: datos.usuario, password: datos.password, rol: datos.rol, activo: true };
  if (API_LISTO) {
    try {
      return await api.post('/usuarios', registro);
    } catch (err) {
      if (navigator.onLine) throw err;
      encolar({ tipo: 'crear', tabla: TABLA, registro });
      return { ...registro, id: `local-${Date.now()}` };
    }
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.from(TABLA).insert(registro).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      if (navigator.onLine) throw err;
      encolar({ tipo: 'crear', tabla: TABLA, registro });
      return { ...registro, id: `local-${Date.now()}` };
    }
  }
  throw new Error('No hay backend configurado (ni API ni Supabase).');
}

export async function actualizarUsuario(id, cambios) {
  if (API_LISTO) {
    try {
      return await api.patch(`/usuarios/${id}`, cambios);
    } catch (err) {
      if (navigator.onLine) throw err;
      encolar({ tipo: 'actualizar', tabla: TABLA, id, cambios });
      return { id, ...cambios };
    }
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.from(TABLA).update(cambios).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      if (navigator.onLine) throw err;
      encolar({ tipo: 'actualizar', tabla: TABLA, id, cambios });
      return { id, ...cambios };
    }
  }
  throw new Error('No hay backend configurado (ni API ni Supabase).');
}

// Ejecuta UNA operacion encolada de esta tabla. Lo llama el sincronizador
// global (ver sincronizador.js) — no se usa una cola por-proveedor porque
// todas las tablas comparten la misma cola en localStorage.
export async function ejecutarOperacionUsuarios(op) {
  if (op.tipo === 'crear') {
    if (API_LISTO) return void (await api.post('/usuarios', op.registro));
    const { error } = await supabase.from(TABLA).insert(op.registro);
    if (error) throw error;
  } else if (op.tipo === 'actualizar') {
    if (API_LISTO) return void (await api.patch(`/usuarios/${op.id}`, op.cambios));
    const { error } = await supabase.from(TABLA).update(op.cambios).eq('id', op.id);
    if (error) throw error;
  }
}
