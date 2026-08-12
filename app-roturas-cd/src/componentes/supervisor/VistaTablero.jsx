import { useEffect, useMemo, useRef, useState } from 'react';
import { listarRegistros, suscribirseCambios } from '../../datos/registrosProveedor.js';
import { TURNOS_BD, FAMILIA_POR_CODIGO } from '../../datos/maestros.js';
import { tally, tallySum, renderKpis, renderTrend, renderDonut, renderHbars, renderHeat, TCOL } from '../../utilidades/graficos.js';

const PERIODOS = [
  { l: '7 días', v: 7 },
  { l: '15 días', v: 15 },
  { l: '30 días', v: 30 },
  { l: 'Todo', v: 9999 },
];

// El codigo va antes de " - " en el texto del material (ej. "3128 - Aguila
// RN 330cc X 30"); se busca en el maestro de SKU para saber su familia
// (Envase/Ret/Pet/Lata...). Si el codigo no esta en el maestro (material
// escrito a mano, o SKU nuevo que no esta en la base), cae en "Otra".
function familiaDe(r) {
  const codigo = (r.material || '').split(' - ')[0].trim();
  return FAMILIA_POR_CODIGO[codigo] || 'Otra';
}

export function VistaTablero() {
  const [registros, setRegistros] = useState([]);
  const [periodo, setPeriodo] = useState(30);
  const [turno, setTurno] = useState('');
  const [ubic, setUbic] = useState('');
  const [desdeCache, setDesdeCache] = useState(false);

  const tipRef = useRef(null);
  const dkpisRef = useRef(null);
  const trendChartRef = useRef(null);
  const trendNRef = useRef(null);
  const donutCatRef = useRef(null);
  const catNRef = useRef(null);
  const donutTurnoRef = useRef(null);
  const donutFamiliaRef = useRef(null);
  const barCausalRef = useRef(null);
  const insightRef = useRef(null);
  const barUbicRef = useRef(null);
  const barMatRef = useRef(null);
  const heatRef = useRef(null);
  const barConciliadorRef = useRef(null);
  const barRepRef = useRef(null);

  async function recargar() {
    const { datos, desdeCache: fallo } = await listarRegistros();
    setRegistros(datos);
    setDesdeCache(fallo);
  }

  useEffect(() => {
    recargar();
    const detener = suscribirseCambios(() => recargar());
    return detener;
  }, []);

  const topUbicaciones = useMemo(() => tally(registros, (r) => r.ubicacion).slice(0, 5), [registros]);

  const filtrados = useMemo(() => {
    const lim = new Date();
    lim.setDate(lim.getDate() - periodo);
    return registros.filter((r) => {
      if (periodo < 9999 && new Date(r.fecha + 'T12:00:00') < lim) return false;
      if (turno && r.turno !== turno) return false;
      if (ubic && r.ubicacion !== ubic) return false;
      return true;
    });
  }, [registros, periodo, turno, ubic]);

  useEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const R = filtrados;
    renderKpis(dkpisRef.current, R, periodo);
    renderTrend(trendChartRef.current, trendNRef.current, R, periodo, tip);
    const cats = tally(R, (r) => r.causal_categoria);
    catNRef.current.textContent = `${cats.length} activas`;
    renderDonut(donutCatRef.current, cats, null, 'reportes', tip);
    renderDonut(donutTurnoRef.current, tally(R, (r) => r.turno), TCOL, 'reportes', tip);
    renderDonut(donutFamiliaRef.current, tally(R, familiaDe), null, 'reportes', tip);
    renderHbars(barCausalRef.current, tally(R, (r) => r.causal_codigo || r.causal_categoria).slice(0, 7), R.length, 'reportes', tip);
    renderHbars(barUbicRef.current, tally(R, (r) => r.ubicacion).slice(0, 7), R.length, 'reportes', tip);
    renderHbars(
      barMatRef.current,
      tallySum(R, (r) => (r.material || '').split(' - ')[1] || r.material, (r) => r.cantidad).slice(0, 7),
      R.reduce((a, r) => a + (+r.cantidad || 0), 0),
      'unidades',
      tip
    );
    renderHbars(barRepRef.current, tally(R, (r) => r.reportante).slice(0, 7), R.length, 'reportes', tip);
    renderHbars(barConciliadorRef.current, tally(R.filter((r) => r.conciliador), (r) => r.conciliador).slice(0, 6), R.length, 'reportes', tip);
    renderHeat(
      heatRef.current,
      R,
      TURNOS_BD.map((t) => t.c),
      tip
    );
    const tc = tally(R, (r) => r.causal_categoria);
    insightRef.current.innerHTML = tc.length
      ? `La categoría <b>${tc[0][0]}</b> concentra <b>${Math.round((tc[0][1] / (R.length || 1)) * 100)}%</b> de los reportes del periodo (${tc[0][1]} de ${R.length}). Es el frente con mayor retorno para un plan de acción.`
      : 'Sin datos en este filtro.';
  }, [filtrados, periodo]);

  return (
    <section className="section on">
      {desdeCache && (
        <div className="loginerr" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>
            ⚠️ No se pudo conectar con la nube ahorita — estas gráficas usan la última copia guardada en <b>este dispositivo</b>, puede no tener los reportes
            más recientes de otros celulares/PCs.
          </span>
          <button className="btn btn-g" style={{ flexShrink: 0 }} onClick={recargar}>
            🔄 Reintentar
          </button>
        </div>
      )}
      <div className="filters">
        <div className="flabel">Periodo</div>
        <div className="fgroup">
          {PERIODOS.map((p) => (
            <button key={p.v} className={`chip ${periodo === p.v ? 'on' : ''}`} onClick={() => setPeriodo(p.v)}>
              {p.l}
            </button>
          ))}
        </div>
        <div className="flabel" style={{ marginTop: 10 }}>
          Turno_BD
        </div>
        <div className="fgroup">
          <button className={`chip ${turno === '' ? 'on' : ''}`} onClick={() => setTurno('')}>
            Todos
          </button>
          {TURNOS_BD.map((t) => (
            <button key={t.c} className={`chip ${turno === t.c ? 'on' : ''}`} onClick={() => setTurno(t.c)}>
              {t.c}
            </button>
          ))}
        </div>
        <div className="flabel" style={{ marginTop: 10 }}>
          Ubicación
        </div>
        <div className="fgroup">
          <button className={`chip ${ubic === '' ? 'on' : ''}`} onClick={() => setUbic('')}>
            Todas
          </button>
          {topUbicaciones.map(([u]) => (
            <button key={u} className={`chip ${ubic === u ? 'on' : ''}`} onClick={() => setUbic(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="dkpis" ref={dkpisRef}></div>

      <div className="dgrid">
        <div className="card full">
          <div className="chead">
            <h3>Tendencia diaria</h3>
            <span className="n" ref={trendNRef}></span>
          </div>
          <p className="csub">Reportes por día — pasa el cursor sobre los puntos.</p>
          <div ref={trendChartRef}></div>
        </div>
        <div className="card">
          <div className="chead">
            <h3>Categorías de causal</h3>
            <span className="n" ref={catNRef}></span>
          </div>
          <p className="csub">Toca un segmento para aislarlo.</p>
          <div ref={donutCatRef}></div>
        </div>
        <div className="card">
          <div className="chead">
            <h3>Distribución por turno</h3>
            <span className="n">A · B · C</span>
          </div>
          <p className="csub">Carga de reportes en cada turno.</p>
          <div ref={donutTurnoRef}></div>
        </div>
        <div className="card">
          <div className="chead">
            <h3>Por familia</h3>
            <span className="n">Envase · Ret · Pet · Lata</span>
          </div>
          <p className="csub">Roturas agrupadas por familia de material.</p>
          <div ref={donutFamiliaRef}></div>
        </div>
        <div className="card full">
          <div className="chead">
            <h3>Top causales</h3>
            <span className="n">por código</span>
          </div>
          <p className="csub">Las causales más recurrentes del periodo.</p>
          <div ref={barCausalRef}></div>
          <div className="insight" ref={insightRef}></div>
        </div>
        <div className="card">
          <div className="chead">
            <h3>Ubicaciones críticas</h3>
            <span className="n">top 7</span>
          </div>
          <p className="csub">Dónde se concentra la rotura.</p>
          <div ref={barUbicRef}></div>
        </div>
        <div className="card">
          <div className="chead">
            <h3>Materiales más afectados</h3>
            <span className="n">por cantidad</span>
          </div>
          <p className="csub">Suma de unidades rotas por material.</p>
          <div ref={barMatRef}></div>
        </div>
        <div className="card full">
          <div className="chead">
            <h3>Ubicación × Turno</h3>
            <span className="n">mapa de calor</span>
          </div>
          <p className="csub">Intensidad de reportes en cada cruce.</p>
          <div className="heatwrap">
            <div ref={heatRef}></div>
          </div>
        </div>
        <div className="card">
          <div className="chead">
            <h3>Conciliadores</h3>
            <span className="n">carga por persona</span>
          </div>
          <p className="csub">Distribución de eventos conciliados.</p>
          <div ref={barConciliadorRef}></div>
        </div>
        <div className="card">
          <div className="chead">
            <h3>Reportantes activos</h3>
            <span className="n">top 7</span>
          </div>
          <p className="csub">Quién está alimentando el sistema en campo.</p>
          <div ref={barRepRef}></div>
        </div>
      </div>
      <div className="tip" ref={tipRef}></div>
    </section>
  );
}
