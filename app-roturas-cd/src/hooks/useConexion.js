import { useEffect, useState } from 'react';
import { pendientes } from '../datos/colaSincronizacion.js';

// Estado de conexion + cuantas operaciones quedan por sincronizar, para
// mostrar el indicador "Sin conexión · N por sincronizar" en el header.
export function useConexion() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [pendientesN, setPendientesN] = useState(pendientes());

  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const intervalo = setInterval(() => setPendientesN(pendientes()), 4000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(intervalo);
    };
  }, []);

  return { enLinea, pendientes: pendientesN };
}
