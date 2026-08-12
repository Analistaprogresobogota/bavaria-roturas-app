import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../../contexto/useSession.js';
import { CAUSALES, CAT_ORDER, MATERIALES, UBICACIONES, TURNOS_BD, OPMS_SUGERIDOS, ESTADOS_E } from '../../datos/maestros.js';
import { listarUsuarios } from '../../datos/usuariosProveedor.js';
import { crearRegistro } from '../../datos/registrosProveedor.js';
import { comprimirImagen } from '../../utilidades/imagen.js';
import { mostrarToast } from '../comunes/Toast.jsx';
import { FirmaPad } from '../comunes/FirmaPad.jsx';
import { CONFIG } from '../../config.js';

const VACIO = {
  fecha: new Date().toISOString().slice(0, 10),
  turno: '',
  ubicacion: '',
  categoriaFiltro: '',
  causalRaw: '',
  estadoE: '',
  descripcion: '',
  supervisor1: '',
  supervisor2: '',
  conciliador: '',
  opm: '',
};

function lineaVacia() {
  return { id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, materialTexto: '', cantidad: '' };
}

export function VistaOperativo() {
  const { nombre, id: usuarioId } = useSession();
  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState(VACIO);
  const [materiales, setMateriales] = useState([lineaVacia()]);
  const [errores, setErrores] = useState({});
  const [erroresMat, setErroresMat] = useState({});
  const [foto, setFoto] = useState(null); // {dataUri, nombre}
  const [fotoConc, setFotoConc] = useState(null);
  const [firma, setFirma] = useState('');
  const [firmaKey, setFirmaKey] = useState(0);
  const [supervisores, setSupervisores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listarUsuarios().then((lista) => {
      setSupervisores(lista.filter((u) => u.rol === 'supervisor' || u.rol === 'admin').map((u) => u.nombre));
    });
  }, []);

  const causalesFiltradas = useMemo(
    () => CAUSALES.filter((c) => !form.categoriaFiltro || c.cat === form.categoriaFiltro),
    [form.categoriaFiltro]
  );
  const categoriasEnOrden = useMemo(
    () => CAT_ORDER.filter((cat) => causalesFiltradas.some((c) => c.cat === cat)),
    [causalesFiltradas]
  );
  const causalSeleccionada = CAUSALES.find((c) => c.raw === form.causalRaw);

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function setMaterial(id, campo, valor) {
    setMateriales((lista) => lista.map((m) => (m.id === id ? { ...m, [campo]: valor } : m)));
  }

  function agregarMaterial() {
    setMateriales((lista) => [...lista, lineaVacia()]);
  }

  function quitarMaterial(id) {
    setMateriales((lista) => (lista.length > 1 ? lista.filter((m) => m.id !== id) : lista));
  }

  async function elegirFoto(e, cual) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const dataUri = await comprimirImagen(archivo);
      const valor = { dataUri, nombre: archivo.name };
      if (cual === 'C') setFotoConc(valor);
      else setFoto(valor);
    } catch {
      mostrarToast('No se pudo procesar la foto', 'err');
    }
  }

  function validar() {
    const req = { fecha: form.fecha, turno: form.turno, ubicacion: form.ubicacion, causalRaw: form.causalRaw };
    const err = {};
    Object.entries(req).forEach(([k, v]) => {
      if (!v) err[k] = true;
    });
    if (!foto) err.foto = true;
    if (!firma) err.firma = true;

    const errMat = {};
    materiales.forEach((m, i) => {
      // la primera linea siempre es obligatoria; las siguientes solo si
      // tienen algo escrito (una linea vacia de mas simplemente se ignora).
      const tocaValidar = i === 0 || m.materialTexto || m.cantidad;
      if (tocaValidar && !m.materialTexto) errMat[m.id] = { ...errMat[m.id], materialTexto: true };
      if (tocaValidar && !m.cantidad) errMat[m.id] = { ...errMat[m.id], cantidad: true };
    });

    setErrores(err);
    setErroresMat(errMat);
    if (Object.keys(err).length || Object.keys(errMat).length) {
      mostrarToast('Completa los campos obligatorios', 'err');
      return false;
    }
    return true;
  }

  function irRevisar() {
    if (!validar()) return;
    setPaso(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const materialesValidos = materiales.filter((m) => m.materialTexto && m.cantidad);

  async function guardar() {
    setGuardando(true);
    try {
      for (const m of materialesValidos) {
        await crearRegistro({
          fecha: form.fecha,
          turno: form.turno,
          ubicacion: form.ubicacion,
          material: m.materialTexto,
          cantidad: Number(m.cantidad) || 0,
          causal_codigo: causalSeleccionada?.code || '',
          causal_label: causalSeleccionada?.label || form.causalRaw,
          causal_categoria: causalSeleccionada?.cat || '',
          estado_e: form.estadoE,
          descripcion: form.descripcion || 'Sin Observación',
          reportante: nombre,
          reportante_usuario_id: usuarioId,
          supervisor1: form.supervisor1,
          supervisor2: form.supervisor2,
          conciliador: form.conciliador,
          opm: form.opm,
          foto: foto?.dataUri || '',
          foto_conciliador: fotoConc?.dataUri || '',
          firma: firma || '',
          sede: CONFIG.sede,
        });
      }
      mostrarToast(materialesValidos.length > 1 ? `✓ ${materialesValidos.length} roturas guardadas` : '✓ Rotura guardada', 'ok');
      setForm(VACIO);
      setMateriales([lineaVacia()]);
      setFoto(null);
      setFotoConc(null);
      setFirma('');
      setFirmaKey((k) => k + 1);
      setErrores({});
      setErroresMat({});
      setPaso(1);
    } catch {
      mostrarToast('No se pudo guardar. Quedó pendiente para sincronizar.', 'err');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="section on">
      <div className="steps">
        <div className={`step ${paso === 1 ? 'act' : 'done'}`}>
          <div className="n">1</div>Reporte
        </div>
        <div className={`step ${paso === 2 ? 'act' : ''}`}>
          <div className="n">2</div>Revisar
        </div>
      </div>

      {paso === 1 && (
        <div className="card">
          <div className="modtag">
            <i>01</i>Datos del evento
          </div>
          <h2 className="ct">Registro de rotura</h2>
          <p className="sub">Reportante: {nombre}. Con evidencia fotográfica.</p>
          <div className="grid">
            <div>
              <label>
                Fecha del Evento <span className="req">*</span>
              </label>
              <input type="date" className={errores.fecha ? 'err' : ''} value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
            </div>
            <div>
              <label>
                Turno_BD <span className="req">*</span>
              </label>
              <select className={errores.turno ? 'err' : ''} value={form.turno} onChange={(e) => set('turno', e.target.value)}>
                <option value="">— Selecciona —</option>
                {TURNOS_BD.map((t) => (
                  <option key={t.c} value={t.c}>
                    {t.l}
                  </option>
                ))}
              </select>
            </div>
            <div className="full">
              <label>
                Ubicación <span className="req">*</span>
              </label>
              <select className={errores.ubicacion ? 'err' : ''} value={form.ubicacion} onChange={(e) => set('ubicacion', e.target.value)}>
                <option value="">— Selecciona ubicación —</option>
                {UBICACIONES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="full">
              <label>
                Material <span className="req">*</span> <span style={{ fontWeight: 500, color: 'var(--mut)' }}>({MATERIALES.length} en base)</span>
              </label>
              {materiales.map((m, i) => {
                const seleccionado = MATERIALES.find((x) => x.m === m.materialTexto);
                const errM = erroresMat[m.id] || {};
                return (
                  <div key={m.id}>
                    <div className="matlinea">
                      <div className="mm">
                        <input
                          list="matList"
                          className={errM.materialTexto ? 'err' : ''}
                          value={m.materialTexto}
                          onChange={(e) => setMaterial(m.id, 'materialTexto', e.target.value)}
                          placeholder="Escribe código o nombre del material…"
                          autoComplete="off"
                        />
                      </div>
                      <div className="cc">
                        <input
                          type="number"
                          min="1"
                          className={errM.cantidad ? 'err' : ''}
                          value={m.cantidad}
                          onChange={(e) => setMaterial(m.id, 'cantidad', e.target.value)}
                          placeholder="Cant."
                        />
                      </div>
                      {materiales.length > 1 && (
                        <button type="button" className="quitar" onClick={() => quitarMaterial(m.id)} title="Quitar este material">
                          ×
                        </button>
                      )}
                    </div>
                    {seleccionado && (
                      <div className="picked show" style={{ marginTop: -2 }}>
                        <b>{seleccionado.m}</b>
                      </div>
                    )}
                  </div>
                );
              })}
              <datalist id="matList">
                {MATERIALES.map((m) => (
                  <option key={m.m} value={m.m} />
                ))}
              </datalist>
              <button type="button" className="addmat" onClick={agregarMaterial}>
                + Añadir otro material
              </button>
              <div className="help">Cada material se guarda como una rotura independiente en Registros, con los mismos datos de este reporte.</div>
            </div>

            <div className="full">
              <label>
                Causal <span className="req">*</span> <span style={{ fontWeight: 500, color: 'var(--mut)' }}>({CAUSALES.length} catalogadas)</span>
              </label>
              <select value={form.categoriaFiltro} onChange={(e) => { set('categoriaFiltro', e.target.value); set('causalRaw', ''); }}>
                <option value="">— Filtrar por categoría (ayuda) —</option>
                {[...new Set(CAUSALES.map((c) => c.cat))].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select className={errores.causalRaw ? 'err' : ''} style={{ marginTop: 8 }} value={form.causalRaw} onChange={(e) => set('causalRaw', e.target.value)}>
                <option value="">— Selecciona causal —</option>
                {categoriasEnOrden.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {causalesFiltradas
                      .filter((c) => c.cat === cat)
                      .map((c) => (
                        <option key={c.raw} value={c.raw}>
                          {c.code} · {c.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {causalSeleccionada && (
                <div className="picked show">
                  <span className="tagchip">{causalSeleccionada.cat}</span>
                  <span className="tagchip">{causalSeleccionada.code}</span>
                  <br />
                  {causalSeleccionada.desc || causalSeleccionada.label}
                </div>
              )}
            </div>
            <div className="full">
              <label>Estado</label>
              <select value={form.estadoE} onChange={(e) => set('estadoE', e.target.value)}>
                <option value="">— Selecciona estado —</option>
                {ESTADOS_E.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="full">
              <label>Descripción</label>
              <textarea value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Sin Observación" />
            </div>

            <div className="full">
              <div className="modtag" style={{ marginTop: 10 }}>
                <i>03</i>Responsables
              </div>
            </div>
            <div>
              <label>Coordinador</label>
              <input list="supList" value={form.supervisor1} onChange={(e) => set('supervisor1', e.target.value)} placeholder="Nombre" autoComplete="off" />
              <datalist id="supList">
                {supervisores.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label>Supervisor</label>
              <input list="sup2List" value={form.supervisor2} onChange={(e) => set('supervisor2', e.target.value)} placeholder="Nombre" autoComplete="off" />
              <datalist id="sup2List">
                {supervisores.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label>Conciliador</label>
              <input value={form.conciliador} onChange={(e) => set('conciliador', e.target.value)} placeholder="Nombre del conciliador" autoComplete="off" />
            </div>
            <div>
              <label>OPM</label>
              <input list="opmList" value={form.opm} onChange={(e) => set('opm', e.target.value)} placeholder="NO APLICA / NR / nombre" autoComplete="off" />
              <datalist id="opmList">
                {OPMS_SUGERIDOS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>

            <div className="full">
              <div className="modtag" style={{ marginTop: 10 }}>
                <i>02</i>Evidencia fotográfica
              </div>
            </div>
            <div>
              <label>
                Foto del suceso <span className="req">*</span>
              </label>
              <CampoFoto valor={foto} error={errores.foto} onElegir={(e) => elegirFoto(e, '')} onQuitar={() => setFoto(null)} icono="📷" texto="Toca para tomar o adjuntar la foto" nombreVerificado="✓ Evidencia adjunta" />
            </div>
            <div>
              <label>
                Foto conciliador <span style={{ fontWeight: 500, color: 'var(--mut)' }}>(opcional)</span>
              </label>
              <CampoFoto valor={fotoConc} onElegir={(e) => elegirFoto(e, 'C')} onQuitar={() => setFotoConc(null)} icono="🖊️" texto="Foto del acta o firma de conciliación" nombreVerificado="✓ Conciliación adjunta" />
            </div>

            <div className="full">
              <label>
                Firma electrónica <span className="req">*</span>
              </label>
              <FirmaPad key={firmaKey} onChange={setFirma} error={errores.firma} />
            </div>
          </div>
          <div className="navbtns">
            <button className="btn btn-p" onClick={irRevisar}>
              Revisar reporte →
            </button>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="card">
          <div className="modtag">
            <i>✓</i>Revisión
          </div>
          <h2 className="ct">Confirmar reporte</h2>
          <p className="sub">Verifica antes de guardar. Al confirmar queda visible de inmediato.</p>
          {foto && <img src={foto.dataUri} style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} alt="Evidencia" />}
          <div>
            <Fila etiqueta="Fecha del Evento" valor={form.fecha} />
            <Fila etiqueta="Turno_BD" valor={TURNOS_BD.find((t) => t.c === form.turno)?.l || form.turno} />
            <Fila etiqueta="Ubicación" valor={form.ubicacion} />
          </div>
          <div className="picked show" style={{ marginTop: 10 }}>
            <b>{materialesValidos.length} material{materialesValidos.length === 1 ? '' : 'es'}</b>
            {materialesValidos.map((m) => (
              <div key={m.id} className="revrow">
                <span>{m.materialTexto}</span>
                <b>{m.cantidad}</b>
              </div>
            ))}
          </div>
          <div>
            <Fila etiqueta="Causal" valor={causalSeleccionada ? `${causalSeleccionada.code} · ${causalSeleccionada.label}` : form.causalRaw} />
            <Fila etiqueta="Estado" valor={form.estadoE} />
            <Fila etiqueta="Descripción" valor={form.descripcion || 'Sin Observación'} />
            <Fila etiqueta="Reportante" valor={nombre} />
            <Fila etiqueta="Coordinador" valor={form.supervisor1} />
            <Fila etiqueta="Supervisor" valor={form.supervisor2} />
            <Fila etiqueta="Conciliador" valor={form.conciliador} />
            <Fila etiqueta="OPM" valor={form.opm} />
            <Fila etiqueta="Foto del suceso" valor={foto ? '✓ adjunta' : '—'} />
            <Fila etiqueta="Foto conciliador" valor={fotoConc ? '✓ adjunta' : '—'} />
            <Fila etiqueta="Firma" valor={firma ? '✓ capturada' : '—'} />
          </div>
          <div className="navbtns">
            <button className="btn btn-g" onClick={() => setPaso(1)}>
              ← Editar
            </button>
            <button className="btn btn-ok" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : '✓ Guardar rotura'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Fila({ etiqueta, valor }) {
  return (
    <div className="revrow">
      <span>{etiqueta}</span>
      <b>{valor || '—'}</b>
    </div>
  );
}

function CampoFoto({ valor, error, onElegir, onQuitar, icono, texto, nombreVerificado }) {
  if (valor) {
    return (
      <div className="photoloaded" style={{ display: 'block' }}>
        <img src={valor.dataUri} alt="" />
        <div className="photo-meta">
          <span>{nombreVerificado}</span>
          <button type="button" onClick={onQuitar}>
            Quitar
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={`photobox ${error ? 'err' : ''}`}>
      <div>
        <div className="cam">{icono}</div>
        <p>{texto}</p>
      </div>
      <input type="file" accept="image/*" capture="environment" onChange={onElegir} />
    </div>
  );
}
