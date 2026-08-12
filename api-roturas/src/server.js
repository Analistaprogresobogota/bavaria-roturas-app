import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool } from './db.js';
import { registrosRouter } from './routes/registros.js';
import { usuariosRouter } from './routes/usuarios.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN?.split(',') }));
// Limite alto: un registro puede traer 2 fotos + firma en base64 (varios MB).
app.use(express.json({ limit: '25mb' }));

app.get('/salud', async (req, res) => {
  try {
    await pool.query('select 1');
    res.json({ estado: 'ok', base_de_datos: 'conectada' });
  } catch (err) {
    res.status(500).json({ estado: 'error', detalle: err.message });
  }
});

app.use('/registros', registrosRouter);
app.use('/usuarios', usuariosRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API de Roturas escuchando en el puerto ${PORT}`);
});
