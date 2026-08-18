import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool, tabla, SCHEMA } from './db.js';
import { registrosRouter } from './routes/registros.js';
import { usuariosRouter } from './routes/usuarios.js';
import { evidenciasRouter } from './routes/evidencias.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN?.split(',') }));
app.use(express.json({ limit: '2mb' }));

// El endpoint de salud valida dos cosas: que Postgres responde, y que el
// esquema "progreso" es realmente el que la API esta usando — un simple
// "select 1" puede pasar aunque las consultas reales fallen por apuntar al
// esquema equivocado (ver informe tecnico de Tecnologia).
app.get('/salud', async (req, res) => {
  try {
    const { rows } = await pool.query(`select count(*)::int as total from ${tabla('usuarios')}`);
    res.json({ estado: 'ok', base_de_datos: 'conectada', esquema: SCHEMA, usuarios_en_esquema: rows[0].total });
  } catch (err) {
    res.status(500).json({ estado: 'error', esquema: SCHEMA, detalle: err.message });
  }
});

app.use('/registros', registrosRouter);
app.use('/usuarios', usuariosRouter);
app.use('/evidencias', evidenciasRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API de Roturas escuchando en el puerto ${PORT} (esquema: ${SCHEMA})`);
});
