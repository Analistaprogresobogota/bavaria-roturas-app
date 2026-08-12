import { useEffect, useState } from 'react';

let listener = null;
export function mostrarToast(mensaje, tipo = '') {
  if (listener) listener(mensaje, tipo);
}

export function Toast() {
  const [estado, setEstado] = useState({ mensaje: '', tipo: '', visible: false });

  useEffect(() => {
    let timeout;
    listener = (mensaje, tipo) => {
      clearTimeout(timeout);
      setEstado({ mensaje, tipo, visible: true });
      timeout = setTimeout(() => setEstado((s) => ({ ...s, visible: false })), 2200);
    };
    return () => {
      listener = null;
      clearTimeout(timeout);
    };
  }, []);

  return <div className={`toast ${estado.visible ? 'show' : ''} ${estado.tipo}`}>{estado.mensaje}</div>;
}
