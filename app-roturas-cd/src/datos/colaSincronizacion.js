// Cache local + cola de escrituras pendientes: para que el personal
// operativo pueda seguir reportando roturas aunque se quede sin señal en
// medio de la bodega. Las lecturas caen al ultimo dato conocido si falla la
// red; las escrituras que fallan se guardan en una cola en localStorage que
// se reintenta sola cuando vuelve el internet.
const PREFIJO = 'roturas_cd_v1_';

export function leerCache(tabla) {
  try {
    const crudo = localStorage.getItem(`${PREFIJO}cache_${tabla}`);
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

export function escribirCache(tabla, datos) {
  try {
    localStorage.setItem(`${PREFIJO}cache_${tabla}`, JSON.stringify(datos));
  } catch {
    // almacenamiento lleno o no disponible: no es critico, se sigue sin cache
  }
}

function leerCola() {
  try {
    const crudo = localStorage.getItem(`${PREFIJO}cola`);
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

function escribirCola(cola) {
  try {
    localStorage.setItem(`${PREFIJO}cola`, JSON.stringify(cola));
  } catch {
    // no-op
  }
}

export function encolar(operacion) {
  const cola = leerCola();
  const op = { ...operacion, id: `op-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  cola.push(op);
  escribirCola(cola);
  return op;
}

export function pendientes() {
  return leerCola().length;
}

export function listarCola() {
  return leerCola();
}

let procesando = false;

// ejecutarOperacion(op) debe lanzar si falla (sin conexion, error del server).
export async function procesarCola(ejecutarOperacion) {
  if (procesando) return;
  procesando = true;
  try {
    let cola = leerCola();
    for (const op of [...cola]) {
      try {
        await ejecutarOperacion(op);
        cola = cola.filter((o) => o.id !== op.id);
        escribirCola(cola);
      } catch {
        break; // sigue sin conexion: se detiene aqui y reintenta mas tarde
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
