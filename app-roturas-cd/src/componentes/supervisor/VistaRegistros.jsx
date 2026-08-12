import { useEffect, useMemo, useState } from 'react';
import { listarRegistros, obtenerRegistroCompleto, eliminarRegistro, suscribirseCambios } from '../../datos/registrosProveedor.js';
import { descargarExcel } from '../../utilidades/exportarExcel.js';
import { mostrarToast } from '../comunes/Toast.jsx';

const COLUMNAS = [
  { k: 'fecha', l: 'Fecha del Evento' },
  { k: 'turno', l: 'Turno_BD' },
  { k: 'ubicacion', l: 'Ubicación' },
  { k: 'material', l: 'Material' },
  { k: 'cantidad', l: 'Cantidad' },
  { k: 'causal_categoria', l: 'Causal' },
  { k: 'estado_e', l: 'Estado' },
  { k: 'descripcion', l: 'Descripción' },
  { k: 'reportante', l: 'Reportante' },
  { k: 'supervisor1', l: 'Coordinador' },
  { k: 'supervisor2', l: 'Supervisor' },
  { k: 'conciliador', l: 'Conciliador' },
  { k: 'opm', l: 'OPM' },
];

// Fotos reales vienen como data URI ("data:image/..."); el seed historico
// viejo a veces trae el texto plano "CONC" como marcador de "conciliado sin
// foto" — no es una imagen, no se debe intentar renderizar como <img>.
function esImagenValida(v) {
  return typeof v === 'string' && v.startsWith('data:image');
}

export function VistaRegistros({ puedeEliminar }) {
  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ k: 'creado_en', d: -1 });
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  async function recargar() {
    const { datos, desdeCache: fallo } = await listarRegistros();
    setRegistros(datos);
    setDesdeCache(fallo);
    setCargando(false);
  }

  useEffect(() => {
    recargar();
    const detener = suscribirseCambios(() => recargar());
    return detener;
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    let r = registros.filter(
      (x) =>
        !q ||
        [x.id, x.material, x.causal_label, x.causal_categoria, x.estado_e, x.ubicacion, x.reportante, x.supervisor1, x.supervisor2, x.conciliador, x.opm, x.descripcion]
          .join(' ')
          .toLowerCase()
          .includes(q)
    );
    r = [...r].sort((a, b) => {
      let x = a[orden.k];
      let y = b[orden.k];
      if (orden.k === 'cantidad') {
        x = Number(x) || 0;
        y = Number(y) || 0;
      }
      if (x > y) return orden.d;
      if (x < y) return -orden.d;
      return 0;
    });
    return r;
  }, [registros, busqueda, orden]);

  function cambiarOrden(k) {
    setOrden((o) => (o.k === k ? { k, d: -o.d } : { k, d: 1 }));
  }

  function flecha(k) {
    if (orden.k !== k) return <span className="ar"> ⇅</span>;
    return orden.d > 0 ? ' ▲' : ' ▼';
  }

  function exportar() {
    const filas = filtrados.map((r) => ({
      'Fecha del Evento': r.fecha,
      Turno_BD: r.turno,
      Ubicación: r.ubicacion,
      Material: r.material,
      Cantidad: r.cantidad,
      'Causal (código)': r.causal_codigo,
      'Causal (detalle)': r.causal_label,
      Categoría: r.causal_categoria,
      Estado: r.estado_e,
      Descripción: r.descripcion,
      Reportante: r.reportante,
      Coordinador: r.supervisor1,
      Supervisor: r.supervisor2,
      Conciliador: r.conciliador,
      OPM: r.opm,
      'Foto suceso': r.tiene_foto ? 'Sí' : 'No',
      'Foto conciliador': r.tiene_foto_conciliador ? 'Sí' : 'No',
      Firma: r.tiene_firma ? 'Sí' : 'No',
      'Creado en': r.creado_en,
    }));
    descargarExcel(`registros_roturas_${new Date().toISOString().slice(0, 10)}`, filas);
    mostrarToast(`✓ Excel descargado (${filas.length} filas)`, 'ok');
  }

  async function abrirDetalle(fila) {
    setDetalle(fila); // se ve de una con lo liviano que ya hay, mientras llega lo completo
    setCargandoDetalle(true);
    try {
      const completo = await obtenerRegistroCompleto(fila.id);
      setDetalle(completo || fila);
    } catch {
      mostrarToast('No se pudo cargar el detalle completo (fotos/firma). Verifica tu conexión.', 'err');
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function eliminar(id) {
    await eliminarRegistro(id);
    setDetalle(null);
    recargar();
    mostrarToast('Registro eliminado', 'err');
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const totalUnidades = registros.reduce((a, r) => a + (Number(r.cantidad) || 0), 0);
  const reportesHoy = registros.filter((r) => r.fecha === hoy).length;
  const conteoUbic = {};
  registros.forEach((r) => (conteoUbic[r.ubicacion] = (conteoUbic[r.ubicacion] || 0) + 1));
  const topUbic = Object.entries(conteoUbic).sort((a, b) => b[1] - a[1])[0];

  return (
    <section className="section on">
      {desdeCache && (
        <div className="loginerr" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>
            ⚠️ No se pudo conectar con la nube ahorita — esto muestra la última copia guardada en <b>este dispositivo</b>, puede no tener los reportes más
            recientes de otros celulares/PCs.
          </span>
          <button className="btn btn-g" style={{ flexShrink: 0 }} onClick={recargar}>
            🔄 Reintentar
          </button>
        </div>
      )}
      <div className="kpibar">
        <div className="kpi">
          <div className="v">{registros.length}</div>
          <div className="l">Reportes</div>
        </div>
        <div className="kpi">
          <div className="v">{totalUnidades}</div>
          <div className="l">Cantidad</div>
        </div>
        <div className="kpi">
          <div className="v">{reportesHoy}</div>
          <div className="l">Hoy</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ fontSize: 13 }}>
            {topUbic ? topUbic[0].slice(0, 9) : '—'}
          </div>
          <div className="l">Top ubicación</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <input className="tsearch" style={{ marginBottom: 0, flex: 1 }} placeholder="🔎 Buscar por material, causal, ubicación, reportante…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className="btn btn-ok" style={{ flex: '0 0 auto', padding: '0 18px' }} onClick={exportar}>
          ⬇ Descargar Excel
        </button>
      </div>

      {cargando ? (
        <div className="empty">
          <div className="big">⏳</div>
          <p>Cargando registros…</p>
        </div>
      ) : !filtrados.length ? (
        <div className="empty">
          <div className="big">📋</div>
          <p>{busqueda ? 'Sin resultados para esa búsqueda.' : 'Aún no hay roturas reportadas.'}</p>
        </div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {COLUMNAS.map((c) => (
                  <th key={c.k} onClick={() => cambiarOrden(c.k)}>
                    {c.l}
                    {flecha(c.k)}
                  </th>
                ))}
                <th>Foto suceso</th>
                <th>Foto conciliador</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id} onClick={() => abrirDetalle(r)}>
                  <td>{r.fecha}</td>
                  <td>
                    <span className="tb">{r.turno}</span>
                  </td>
                  <td>{r.ubicacion}</td>
                  <td className="wrapc" title={r.material}>
                    {r.material}
                  </td>
                  <td style={{ textAlign: 'center' }}>{r.cantidad}</td>
                  <td className="wrapc" title={r.causal_label}>
                    {r.causal_codigo} {r.causal_categoria}
                  </td>
                  <td>{r.estado_e || '—'}</td>
                  <td className="wrapc" title={r.descripcion}>
                    {r.descripcion}
                  </td>
                  <td>{r.reportante}</td>
                  <td>{r.supervisor1}</td>
                  <td>{r.supervisor2}</td>
                  <td>{r.conciliador}</td>
                  <td>{r.opm}</td>
                  <td>{r.tiene_foto ? <div className="noimg ok">📷</div> : <div className="noimg">—</div>}</td>
                  <td>{r.tiene_foto_conciliador ? <div className="noimg ok">🖊</div> : <div className="noimg">—</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <div className="modal show" onClick={(e) => e.target.classList.contains('modal') && setDetalle(null)}>
          <div className="sheet">
            <h3>{detalle.id}</h3>
            {cargandoDetalle && <p className="help">⏳ Cargando fotos y firma…</p>}
            {esImagenValida(detalle.foto) && (
              <>
                <div className="help">Foto del suceso</div>
                <img src={detalle.foto} alt="" onClick={() => setLightbox(detalle.foto)} style={{ cursor: 'zoom-in' }} />
              </>
            )}
            {esImagenValida(detalle.foto_conciliador) && (
              <>
                <div className="help">Foto del conciliador</div>
                <img src={detalle.foto_conciliador} alt="" onClick={() => setLightbox(detalle.foto_conciliador)} style={{ cursor: 'zoom-in' }} />
              </>
            )}
            {esImagenValida(detalle.firma) && (
              <>
                <div className="help">Firma</div>
                <img src={detalle.firma} alt="" style={{ background: '#fff', border: '1px solid var(--line)' }} />
              </>
            )}
            {[
              ['Fecha del Evento', detalle.fecha],
              ['Turno_BD', detalle.turno],
              ['Ubicación', detalle.ubicacion],
              ['Material', detalle.material],
              ['Cantidad', detalle.cantidad],
              ['Causal', `${detalle.causal_codigo ? detalle.causal_codigo + ' · ' : ''}${detalle.causal_label}`],
              ['Categoría', detalle.causal_categoria],
              ['Estado', detalle.estado_e || '—'],
              ['Descripción', detalle.descripcion || '—'],
              ['Reportante', detalle.reportante],
              ['Coordinador', detalle.supervisor1 || '—'],
              ['Supervisor', detalle.supervisor2 || '—'],
              ['Conciliador', detalle.conciliador || '—'],
              ['OPM', detalle.opm || '—'],
              ['Foto conciliador', esImagenValida(detalle.foto_conciliador) || detalle.tiene_foto_conciliador ? '✓ adjunta' : 'Pendiente'],
              ['Firma', esImagenValida(detalle.firma) || detalle.tiene_firma ? '✓ capturada' : 'Pendiente'],
            ].map(([k, v]) => (
              <div className="revrow" key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
            <div className="navbtns" style={{ marginTop: 16 }}>
              <button className="btn btn-g" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
              {puedeEliminar && (
                <button className="btn btn-g" style={{ color: 'var(--bav)' }} onClick={() => eliminar(detalle.id)}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </section>
  );
}
