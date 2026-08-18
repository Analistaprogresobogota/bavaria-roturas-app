import { useEffect, useState } from 'react';
import { pendientes } from '../datos/colaSincronizacion.js';

// Estado de conexion + cuantas operaciones quedan por sincronizar, para
// mostrar el indicador "Sin conexión · N por sincronizar" en el header.
// pendientes() es async (la cola vive en IndexedDB, no en localStorage —
// ver colaSincronizacion.js), asi que el conteo arranca en 0 y se actualiza
// apenas resuelve la primera consulta.
export function useConexion() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [pendientesN, setPendientesN] = useState(0);

  useEffect(() => {
    let vivo = true;
    const actualizarPendientes = () => {
      pendientes().then((n) => {
        if (vivo) setPendientesN(n);
      });
    };
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const intervalo = setInterval(actualizarPendientes, 4000);
    actualizarPendientes();
    return () => {
      vivo = false;
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(intervalo);
    };
  }, []);

  return { enLinea, pendientes: pendientesN };
}
