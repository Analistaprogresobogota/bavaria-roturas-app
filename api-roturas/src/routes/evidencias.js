import { Router } from 'express';
import multer from 'multer';
import { validarEvidencia, subirEvidencia, eliminarEvidencia, urlTemporal } from '../storage.js';

export const evidenciasRouter = Router();

// En memoria: los archivos son pequeños (foto/firma, tope 8 MB) y se suben
// directo a Azure sin pasar por disco.
const upload = multer({ storage: multer.memoryStorage() });

// POST /evidencias?tipo=suceso|conciliador|firma  (multipart/form-data, campo "archivo")
// Sube UNA evidencia y devuelve su ruta relativa. El flujo esperado del
// cliente es: subir cada evidencia primero, guardar la ruta que devuelve
// este endpoint, y recien despues crear el/los registro(s) en POST
// /registros usando esa ruta como valor de foto/foto_conciliador/firma.
//
// Si un mismo evento tiene varios materiales (varias filas en /registros),
// el cliente debe llamar este endpoint UNA sola vez por evidencia y
// reutilizar la misma ruta en todas las filas — nunca subir la misma foto
// varias veces.
evidenciasRouter.post('/', upload.single('archivo'), async (req, res) => {
  const tipo = req.query.tipo;
  const error = validarEvidencia(tipo, req.file);
  if (error) return res.status(400).json({ error });
  try {
    const ruta = await subirEvidencia(tipo, req.file);
    res.status(201).json({ ruta });
  } catch (err) {
    console.error('POST /evidencias', err);
    res.status(500).json({ error: 'No se pudo subir la evidencia.' });
  }
});

// DELETE /evidencias?ruta=progreso/2026/08/...  — limpieza de un archivo
// huerfano: el cliente subio la evidencia pero abortó antes de crear el
// registro (por ejemplo el usuario cancelo el formulario a mitad de camino).
evidenciasRouter.delete('/', async (req, res) => {
  const ruta = req.query.ruta;
  if (!ruta) return res.status(400).json({ error: 'Falta el parametro ruta.' });
  try {
    await eliminarEvidencia(ruta);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /evidencias', err);
    res.status(500).json({ error: 'No se pudo eliminar la evidencia.' });
  }
});

// GET /evidencias/url?ruta=progreso/2026/08/...  — URL temporal firmada (10
// min por defecto) para mostrar una evidencia puntual en el detalle de un
// registro. El contenedor sigue siendo privado; nunca se expone una URL
// publica ni permanente.
evidenciasRouter.get('/url', (req, res) => {
  const ruta = req.query.ruta;
  if (!ruta) return res.status(400).json({ error: 'Falta el parametro ruta.' });
  try {
    res.json({ url: urlTemporal(ruta) });
  } catch (err) {
    console.error('GET /evidencias/url', err);
    res.status(500).json({ error: 'No se pudo generar la URL temporal.' });
  }
});
