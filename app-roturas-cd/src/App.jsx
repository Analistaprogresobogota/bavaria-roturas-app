import { useEffect, useState } from 'react';
import { useSession } from './contexto/useSession.js';
import { Header } from './componentes/comunes/Header.jsx';
import { Nav } from './componentes/comunes/Nav.jsx';
import { Toast } from './componentes/comunes/Toast.jsx';
import { VistaLogin } from './componentes/login/VistaLogin.jsx';
import { VistaOperativo } from './componentes/operativo/VistaOperativo.jsx';
import { VistaRegistros } from './componentes/supervisor/VistaRegistros.jsx';
import { VistaTablero } from './componentes/supervisor/VistaTablero.jsx';
import { VistaUsuarios } from './componentes/admin/VistaUsuarios.jsx';
import { iniciarSincronizacionGlobal } from './datos/sincronizador.js';

const TABS_POR_ROL = {
  operativo: [{ id: 'reporte', etiqueta: 'Reporte', icono: '📝' }],
  supervisor: [
    { id: 'registros', etiqueta: 'Registros', icono: '📋' },
    { id: 'tablero', etiqueta: 'Tablero', icono: '📊' },
  ],
  admin: [
    { id: 'reporte', etiqueta: 'Reporte', icono: '📝' },
    { id: 'registros', etiqueta: 'Registros', icono: '📋' },
    { id: 'tablero', etiqueta: 'Tablero', icono: '📊' },
    { id: 'usuarios', etiqueta: 'Usuarios', icono: '👥' },
  ],
};

export default function App() {
  const { autenticado, rol } = useSession();
  const tabs = TABS_POR_ROL[rol] || [];
  const [tab, setTab] = useState(tabs[0]?.id);

  useEffect(() => {
    const detener = iniciarSincronizacionGlobal();
    return detener;
  }, []);

  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === tab)) setTab(tabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol]);

  if (!autenticado) {
    return (
      <>
        <VistaLogin />
        <Toast />
      </>
    );
  }

  return (
    <div className="app">
      <Header />
      <Nav tabs={tabs} activo={tab} onCambiar={setTab} />
      <main>
        {tab === 'reporte' && <VistaOperativo />}
        {tab === 'registros' && <VistaRegistros puedeEliminar={rol === 'admin'} />}
        {tab === 'tablero' && <VistaTablero />}
        {tab === 'usuarios' && <VistaUsuarios />}
      </main>
      <Toast />
      <div className="foot">App de Roturas · CD — Piloto IM Ingeniería / Progreso</div>
    </div>
  );
}
