import { createContext, useMemo, useState } from 'react';

export const SessionContext = createContext(null);

const CLAVE = 'roturas_cd_v1_session';
const SESION_VACIA = { id: null, nombre: null, usuario: null, rol: null };

function cargarSesion() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? JSON.parse(crudo) : SESION_VACIA;
  } catch {
    return SESION_VACIA;
  }
}

function guardarSesion(sesion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // no-op
  }
}

// Sesion persistida en localStorage a proposito (a diferencia de otros
// prototipos): el personal operativo no deberia tener que volver a loguearse
// cada vez que se recarga la app en medio de un turno, sobre todo si en ese
// momento no hay señal para validar contra Supabase.
export function SessionProvider({ children }) {
  const [sesion, setSesion] = useState(cargarSesion);

  const valor = useMemo(
    () => ({
      ...sesion,
      autenticado: Boolean(sesion.id),
      entrar: (usuarioRow) => {
        const nueva = { id: usuarioRow.id, nombre: usuarioRow.nombre, usuario: usuarioRow.usuario, rol: usuarioRow.rol };
        guardarSesion(nueva);
        setSesion(nueva);
      },
      salir: () => {
        guardarSesion(SESION_VACIA);
        setSesion(SESION_VACIA);
      },
    }),
    [sesion]
  );

  return <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>;
}
