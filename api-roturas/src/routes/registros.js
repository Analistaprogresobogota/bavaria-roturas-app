import { Router } from 'express';
import { pool, tabla } from '../db.js';
import { cambios } from '../eventos.js';
import { eliminarEvidencia } from '../storage.js';

export const registrosRouter = Router();

const REGISTROS = tabla('registros');

// GET /registros/eventos — Server-Sent Events: reemplaza el tiempo real de
// Supabase. El cliente abre esta conexion y recibe un mensaje cada vez que
// alguien crea o borra un registro, para refrescar la tabla en pantalla.
registrosRouter.get('/eventos', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const avisar = () => res.write('data: cambio\n\n');
  cambios.on('registros', avisar);

  const latido = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(latido);
    cambios.off('registros', avisar);
  });
});

// Mismas columnas livianas que traia antes el cliente de Supabase — a
// proposito SIN foto/foto_conciliador/firma (pueden pesar cientos de KB
// cada una; traerlas todas en el listado es lo que causaba el timeout
// original, ver migracion-v3.sql del proyecto original).
const COLUMNAS_LISTA = [
  'id', 'creado_en', 'fecha', 'turno', 'ubicacion', 'material', 'cantidad',
  'causal_codigo', 'causal_label', 'causal_categoria', 'estado_e', 'descripcion',
  'reportante', 'reportante_usuario_id', 'supervisor1', 'supervisor2',
  'conciliador', 'opm', 'sede', 'tiene_foto', 'tiene_foto_conciliador', 'tiene_firma',
].join(', ');

// Columnas que la app puede escribir al crear un registro (todo lo demas —
// id, creado_en, tiene_* — lo asigna la base de datos sola).
const COLUMNAS_ESCRIBIBLES = [
  'fecha', 'turno', 'ubicacion', 'material', 'cantidad',
  'causal_codigo', 'causal_label', 'causal_categoria', 'estado_e', 'descripcion',
  'reportante', 'reportante_usuario_id', 'supervisor1', 'supervisor2',
  'conciliador', 'opm', 'foto', 'foto_conciliador', 'firma', 'sede',
];

// GET /registros — listado liviano, mas reciente primero.
registrosRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select ${COLUMNAS_LISTA} from ${REGISTROS} order by creado_en desc`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /registros', err);
    res.status(500).json({ error: 'No se pudo consultar registros.' });
  }
});

// GET /registros/:id — fila completa (incluye foto, foto_conciliador, firma).
registrosRouter.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`select * from ${REGISTROS} where id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'No existe ese registro.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /registros/:id', err);
    res.status(500).json({ error: 'No se pudo consultar el registro.' });
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /registros — crea un registro nuevo. Devuelve la fila completa ya
// creada (con id y creado_en asignados por la base de datos, salvo que el
// cliente ya haya mandado un "id" propio — ver nota de idempotencia abajo).
//
// Idempotencia (ver informe tecnico de Tecnologia, seccion 5.4): la app
// genera el "id" del lado del dispositivo ANTES de intentar subir el
// registro, y lo reutiliza en cada reintento offline. Si el servidor ya
// proceso esa solicitud pero la respuesta nunca llego al dispositivo (se
// corto la señal justo ahi), el reintento con el mismo id no crea una fila
// duplicada — el "on conflict (id) do nothing" lo detecta y aqui se
// devuelve la fila que ya existia, como si la insercion hubiera funcionado
// recien ahora.
registrosRouter.post('/', async (req, res) => {
  try {
    const columnas = COLUMNAS_ESCRIBIBLES.filter((c) => req.body[c] !== undefined);
    if (columnas.length === 0) return res.status(400).json({ error: 'No se envio ningun dato.' });

    const idCliente = typeof req.body.id === 'string' && UUID_RE.test(req.body.id) ? req.body.id : null;
    const columnasFinal = idCliente ? ['id', ...columnas] : columnas;
    const valoresFinal = idCliente ? [idCliente, ...columnas.map((c) => req.body[c])] : columnas.map((c) => req.body[c]);
    const marcadores = columnasFinal.map((_, i) => `$${i + 1}`).join(', ');
    const conflicto = idCliente ? 'on conflict (id) do nothing' : '';

    const { rows } = await pool.query(
      `insert into ${REGISTROS} (${columnasFinal.join(', ')}) values (${marcadores}) ${conflicto} returning *`,
      valoresFinal
    );

    if (rows.length === 0 && idCliente) {
      // Conflicto: esa id ya existia — es un reintento idempotente, no un
      // registro nuevo. Se devuelve la fila ya existente en vez de fallar.
      const existente = await pool.query(`select * from ${REGISTROS} where id = $1`, [idCliente]);
      return res.status(200).json(existente.rows[0]);
    }

    res.status(201).json(rows[0]);
    cambios.emit('registros');
  } catch (err) {
    console.error('POST /registros', err);
    res.status(500).json({ error: 'No se pudo crear el registro.' });
  }
});

// DELETE /registros/:id — borra la fila y, solo si ninguna otra fila
// comparte la misma ruta de evidencia (caso de un evento con varios
// materiales), borra tambien el archivo en la nube. Nunca borra un archivo
// que todavia tenga otra referencia activa.
registrosRouter.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select foto, foto_conciliador, firma from ${REGISTROS} where id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No existe ese registro.' });

    await pool.query(`delete from ${REGISTROS} where id = $1`, [req.params.id]);
    cambios.emit('registros');
    res.status(204).end();

    const rutas = [rows[0].foto, rows[0].foto_conciliador, rows[0].firma].filter(Boolean);
    for (const ruta of rutas) {
      const { rows: otras } = await pool.query(
        `select 1 from ${REGISTROS} where foto = $1 or foto_conciliador = $1 or firma = $1 limit 1`,
        [ruta]
      );
      if (otras.length === 0) {
        eliminarEvidencia(ruta).catch((err) => console.error('Limpieza de evidencia huerfana', ruta, err));
      }
    }
  } catch (err) {
    console.error('DELETE /registros/:id', err);
    res.status(500).json({ error: 'No se pudo eliminar el registro.' });
  }
});
