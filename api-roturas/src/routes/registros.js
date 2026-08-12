import { Router } from 'express';
import { pool } from '../db.js';
import { cambios } from '../eventos.js';

export const registrosRouter = Router();

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
      `select ${COLUMNAS_LISTA} from registros order by creado_en desc`
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
    const { rows } = await pool.query('select * from registros where id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'No existe ese registro.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /registros/:id', err);
    res.status(500).json({ error: 'No se pudo consultar el registro.' });
  }
});

// POST /registros — crea un registro nuevo. Devuelve la fila completa ya
// creada (con id y creado_en asignados por la base de datos).
registrosRouter.post('/', async (req, res) => {
  try {
    const columnas = COLUMNAS_ESCRIBIBLES.filter((c) => req.body[c] !== undefined);
    if (columnas.length === 0) return res.status(400).json({ error: 'No se envio ningun dato.' });
    const valores = columnas.map((c) => req.body[c]);
    const marcadores = columnas.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `insert into registros (${columnas.join(', ')}) values (${marcadores}) returning *`,
      valores
    );
    res.status(201).json(rows[0]);
    cambios.emit('registros');
  } catch (err) {
    console.error('POST /registros', err);
    res.status(500).json({ error: 'No se pudo crear el registro.' });
  }
});

// DELETE /registros/:id
registrosRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('delete from registros where id = $1', [req.params.id]);
    res.status(204).end();
    cambios.emit('registros');
  } catch (err) {
    console.error('DELETE /registros/:id', err);
    res.status(500).json({ error: 'No se pudo eliminar el registro.' });
  }
});
