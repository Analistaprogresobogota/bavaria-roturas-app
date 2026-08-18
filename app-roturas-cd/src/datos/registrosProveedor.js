// Lectura/escritura de la tabla "registros" (una fila = una rotura
// reportada). Escritura offline-first: si falla la red, el registro queda
// guardado ya mismo en la cache local (para que Registros/Tablero lo vean
// de una) y en la cola de sincronizacion (para subirlo solo cuando vuelva
// el internet).
//
// Backend: usa api-roturas (VITE_API_URL) si esta configurada — es la API
// propia que habla con la base de datos de Tecnologia. Si no, cae a
// Supabase (comportamiento original) para no romper el piloto mientras
// Tecnologia no tenga esa API desplegada. Si ninguna esta configurada,
// trabaja solo con la cache local.
import { supabase } from './supabaseClient.js';
import { api, API_LISTO, suscribirseEventos, subirEvidencia, urlEvidencia } from './apiClient.js';
import { SUPABASE_LISTO } from '../config.js';
import { leerCache, escribirCache, encolar } from './colaSincronizacion.js';

const TABLA = 'registros';

// Que campo del registro corresponde a que "tipo" de evidencia en api-roturas.
const CAMPOS_EVIDENCIA = { foto: 'suceso', foto_conciliador: 'conciliador', firma: 'firma' };

// Cache en memoria: si un mismo evento genera varias filas (un reporte con
// varios materiales, ver VistaOperativo), las tres evidencias son
// EXACTAMENTE el mismo data URI en cada llamada — se sube una sola vez y se
// reutiliza la misma ruta en todas las filas, en vez de subir el archivo
// repetido (ver informe tecnico de Tecnologia: "evitar duplicados").
const cacheSubidas = new Map();

async function resolverRutaEvidencia(tipo, dataUri) {
  if (cacheSubidas.has(dataUri)) return cacheSubidas.get(dataUri);
  const promesa = subirEvidencia(tipo, dataUri);
  cacheSubidas.set(dataUri, promesa);
  try {
    return await promesa;
  } catch (err) {
    cacheSubidas.delete(dataUri); // no cachear un intento fallido
    throw err;
  }
}

// Sube a la nube corporativa las evidencias que todavia esten como base64
// (data:image/...;base64,...) y las reemplaza por su ruta relativa antes de
// guardar el registro — Postgres ya nunca vuelve a recibir una imagen
// completa en una columna de texto (ver informe tecnico de Tecnologia).
async function resolverEvidencias(datos) {
  if (!API_LISTO) return datos;
  const resultado = { ...datos };
  for (const [campo, tipo] of Object.entries(CAMPOS_EVIDENCIA)) {
    const valor = resultado[campo];
    if (typeof valor === 'string' && valor.startsWith('data:')) {
      resultado[campo] = await resolverRutaEvidencia(tipo, valor);
    }
  }
  return resultado;
}

// Columnas livianas para Registros/Tablero (solo aplica al camino
// Supabase; api-roturas ya decide esto del lado del servidor) — a
// proposito NO incluye foto, foto_conciliador ni firma (base64, pueden
// pesar cientos de KB cada una). Ver migracion-v3.sql.
const COLUMNAS_LISTA =
  'id,creado_en,fecha,turno,ubicacion,material,cantidad,causal_codigo,causal_label,causal_categoria,estado_e,descripcion,reportante,reportante_usuario_id,supervisor1,supervisor2,conciliador,opm,sede,tiene_foto,tiene_foto_conciliador,tiene_firma';

// Devuelve { datos, desdeCache }. desdeCache=true significa que NO se pudo
// conectar con el backend ahorita y lo que se ve es la ultima copia
// guardada en este dispositivo (puede estar desactualizada frente a lo que
// hay en la nube) — quien llame debe avisarlo en la interfaz, no mostrarlo
// como si fuera el dato fresco.
export async function listarRegistros() {
  if (API_LISTO) {
    try {
      const data = await api.get('/registros');
      await escribirCache(TABLA, data);
      return { datos: data, desdeCache: false };
    } catch (err) {
      console.warn('listarRegistros: no se pudo leer de la API, usando cache local.', err);
      return { datos: await leerCache(TABLA), desdeCache: true };
    }
  }
  if (supabase) {
    try {
      const { data, error } = await supabase.from(TABLA).select(COLUMNAS_LISTA).order('creado_en', { ascending: false });
      if (error) throw error;
      await escribirCache(TABLA, data);
      return { datos: data, desdeCache: false };
    } catch (err) {
      console.warn('listarRegistros: no se pudo leer de Supabase, usando cache local.', err);
      return { datos: await leerCache(TABLA), desdeCache: true };
    }
  }
  return { datos: await leerCache(TABLA), desdeCache: true };
}

// Trae la fila completa (incluidas foto, foto_conciliador y firma) para UN
// registro puntual — se usa solo al abrir su detalle, nunca en el listado.
export async function obtenerRegistroCompleto(id) {
  if (API_LISTO) {
    const registro = await api.get(`/registros/${id}`);
    return resolverUrlsEvidencia(registro);
  }
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLA).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// Con api-roturas, foto/foto_conciliador/firma guardan una RUTA relativa
// (ej. "progreso/2026/08/{uuid}-suceso.jpg"), no la imagen — el contenedor
// es privado, asi que para mostrarla hay que cambiar esa ruta por una URL
// temporal firmada justo antes de pintar el detalle en pantalla. Un valor
// que ya empiece con "data:" es una evidencia capturada offline que todavia
// no se ha subido — se deja tal cual, se ve directo desde el dispositivo.
async function resolverUrlsEvidencia(registro) {
  if (!registro) return registro;
  const resultado = { ...registro };
  for (const campo of ['foto', 'foto_conciliador', 'firma']) {
    const valor = resultado[campo];
    if (typeof valor === 'string' && valor && !valor.startsWith('data:')) {
      try {
        resultado[campo] = await urlEvidencia(valor);
      } catch (err) {
        console.warn(`No se pudo obtener la URL de "${campo}"`, err);
      }
    }
  }
  return resultado;
}

async function subirRegistro(paraSubir) {
  if (API_LISTO) return api.post('/registros', await resolverEvidencias(paraSubir));
  const { data, error } = await supabase.from(TABLA).insert(paraSubir).select().single();
  if (error) throw error;
  return data;
}

async function borrarRegistro(id) {
  if (API_LISTO) return api.del(`/registros/${id}`);
  const { error } = await supabase.from(TABLA).delete().eq('id', id);
  if (error) throw error;
}

export async function crearRegistro(datos) {
  // Con api-roturas, el id se genera ACA (no lo asigna el servidor) y es el
  // mismo en todo intento/reintento offline — es la llave idempotente: ver
  // subirRegistro y POST /registros en api-roturas. Con Supabase (via
  // deprecar) se sigue dejando que el backend asigne el id, como antes.
  const idEstable = API_LISTO && typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : null;
  const registro = {
    ...datos,
    id: idEstable || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creado_en: new Date().toISOString(),
  };

  // Optimista: aparece de inmediato en la cache local, sin esperar red.
  const cache = await leerCache(TABLA);
  await escribirCache(TABLA, [registro, ...cache]);

  const paraSubir = idEstable ? { ...datos, id: idEstable } : datos;

  if ((API_LISTO || SUPABASE_LISTO) && navigator.onLine) {
    try {
      const data = await subirRegistro(paraSubir);
      // reemplaza el id local por el id real que asigno el backend
      const actualizada = (await leerCache(TABLA)).map((r) => (r.id === registro.id ? data : r));
      await escribirCache(TABLA, actualizada);
      return data;
    } catch {
      await encolar({ tipo: 'crear', tabla: TABLA, registro: paraSubir, idLocal: registro.id });
      return registro;
    }
  }

  await encolar({ tipo: 'crear', tabla: TABLA, registro: paraSubir, idLocal: registro.id });
  return registro;
}

export async function eliminarRegistro(id) {
  const cache = (await leerCache(TABLA)).filter((r) => r.id !== id);
  await escribirCache(TABLA, cache);
  if ((API_LISTO || SUPABASE_LISTO) && !String(id).startsWith('local-')) {
    try {
      await borrarRegistro(id);
    } catch (err) {
      if (navigator.onLine) throw err;
      await encolar({ tipo: 'eliminar', tabla: TABLA, id });
    }
  }
}

// Ejecuta UNA operacion encolada de esta tabla (la llama el sincronizador
// global). op.registro ya trae el id estable (ver crearRegistro) cuando
// corresponde — se manda tal cual, sin quitarlo, para que el reintento sea
// idempotente en vez de crear una fila nueva cada vez.
export async function ejecutarOperacionRegistros(op) {
  if (op.tipo === 'crear') {
    const data = await subirRegistro(op.registro);
    if (op.idLocal) {
      const cache = (await leerCache(TABLA)).map((r) => (r.id === op.idLocal ? data : r));
      await escribirCache(TABLA, cache);
    }
  } else if (op.tipo === 'eliminar') {
    await borrarRegistro(op.id);
  }
}

export function suscribirseCambios(callback) {
  if (API_LISTO) return suscribirseEventos('/registros/eventos', callback);
  if (!supabase) return () => {};
  const canal = supabase
    .channel('registros-cambios')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLA }, callback)
    .subscribe();
  return () => supabase.removeChannel(canal);
}
