// Cache local + cola de escrituras pendientes: para que el personal
// operativo pueda seguir reportando roturas aunque se quede sin señal en
// medio de la bodega. Las lecturas caen al ultimo dato conocido si falla la
// red; las escrituras que fallan se guardan en una cola que se reintenta
// sola cuando vuelve el internet.
//
// Usa IndexedDB (no localStorage): un reporte pendiente trae hasta 3
// imagenes en base64 (foto, foto del conciliador, firma), que facilmente
// superan el limite de 5-10 MB de localStorage si se acumulan varios
// reportes sin señal — ver informe tecnico de Tecnologia, seccion 5.4.
const DB_NOMBRE = 'roturas_cd_v2';
const DB_VERSION = 1;
const STORE_CACHE = 'cache';
const STORE_COLA = 'cola';

let dbPromesa = null;
function abrirDB() {
  if (dbPromesa) return dbPromesa;
  dbPromesa = new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE);
      if (!db.objectStoreNames.contains(STORE_COLA)) db.createObjectStore(STORE_COLA, { keyPath: 'id' });
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
  return dbPromesa;
}

async function conTienda(nombreTienda, modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombreTienda, modo);
    const tienda = tx.objectStore(nombreTienda);
    const resultado = fn(tienda);
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function pedido(solicitud) {
  return new Promise((resolve, reject) => {
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

export async function leerCache(tabla) {
  try {
    const datos = await conTienda(STORE_CACHE, 'readonly', (tienda) => pedido(tienda.get(tabla)));
    return (await datos) ?? [];
  } catch {
    return [];
  }
}

export async function escribirCache(tabla, datos) {
  try {
    await conTienda(STORE_CACHE, 'readwrite', (tienda) => tienda.put(datos, tabla));
  } catch {
    // almacenamiento lleno o no disponible: no es critico, se sigue sin cache
  }
}

async function leerCola() {
  try {
    const filas = await conTienda(STORE_COLA, 'readonly', (tienda) => pedido(tienda.getAll()));
    return (await filas) ?? [];
  } catch {
    return [];
  }
}

// Cada operacion encolada trae un id unico generado en el dispositivo — esa
// misma clave se manda a la API como llave de idempotencia (ver
// registrosProveedor.js): si el servidor SI llego a procesar la solicitud
// pero la respuesta nunca llego al dispositivo (se corto la señal justo
// ahi), un reintento con el mismo id no crea un registro duplicado.
export async function encolar(operacion) {
  const op = { ...operacion, id: `op-${Date.now()}-${Math.random().toString(36).slice(2)}`, intentos: 0 };
  try {
    await conTienda(STORE_COLA, 'readwrite', (tienda) => tienda.put(op));
  } catch {
    // no-op: si falla el guardado, el dato ya quedo en la cache optimista
  }
  return op;
}

export async function pendientes() {
  return (await leerCola()).length;
}

export async function listarCola() {
  return leerCola();
}

let procesando = false;

// ejecutarOperacion(op) debe lanzar si falla (sin conexion, error del server).
export async function procesarCola(ejecutarOperacion) {
  if (procesando) return;
  procesando = true;
  try {
    const cola = await leerCola();
    for (const op of cola) {
      try {
        await ejecutarOperacion(op);
        await conTienda(STORE_COLA, 'readwrite', (tienda) => tienda.delete(op.id));
      } catch {
        break; // sigue sin conexion (u otro error): se detiene aqui y reintenta mas tarde
      }
    }
  } finally {
    procesando = false;
  }
}

// Se llama una vez al arrancar: reintenta la cola cuando el navegador avisa
// que volvio internet, y ademas cada 15s por si acaso.
export function activarSincronizacionAutomatica(ejecutarOperacion) {
  const intentar = () => procesarCola(ejecutarOperacion);
  window.addEventListener('online', intentar);
  const intervalo = setInterval(intentar, 15000);
  intentar();
  return () => {
    window.removeEventListener('online', intentar);
    clearInterval(intervalo);
  };
}
