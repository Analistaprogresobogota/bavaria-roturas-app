import { useSession } from '../../contexto/useSession.js';
import { useConexion } from '../../hooks/useConexion.js';

export function Header() {
  const { nombre, rol, salir } = useSession();
  const { enLinea, pendientes } = useConexion();

  return (
    <header>
      <div className="logo">IM</div>
      <div className="htitle">
        <b>App de Roturas · CD</b>
        <span>Ingeniería en Manualidades &amp; Logística · Progreso</span>
      </div>
      <div className="userbar">
        {(!enLinea || pendientes > 0) && (
          <span className="pill offlinepill">{enLinea ? `⏳ ${pendientes} por sincronizar` : '📡 Sin conexión'}</span>
        )}
        <span className="pill" title={rol}>
          {nombre}
        </span>
        <button onClick={salir} title="Cerrar sesión">
          Salir
        </button>
      </div>
    </header>
  );
}
