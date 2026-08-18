#!/usr/bin/env node
// Migra las evidencias (foto, foto_conciliador, firma) de Supabase — donde
// viven como base64 dentro de la fila — hacia el almacenamiento corporativo
// (Azure Blob Storage), y actualiza cada fila de progreso.registros con la
// ruta relativa resultante. Ver informe tecnico de Tecnologia, seccion 5.5
// paso 3: "Para cada imagen historica en base64, crear el archivo
// correspondiente, cargarlo en la nube y sustituir el contenido por la ruta
// relativa."
//
// Requiere que 01_usuarios.sql y 02_registros.sql ya se hayan cargado en
// progreso (mismos "id" que en Supabase — el cruce se hace por id).
//
// Uso:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//   PGHOST=... PGPORT=... PGDATABASE=... PGUSER=... PGPASSWORD=... PGSCHEMA=progreso \
//   AZURE_STORAGE_CONNECTION_STRING=... AZURE_STORAGE_CONTAINER=evidencias-roturas \
//   node migrar-evidencias.mjs [--dry-run] [--limite=50]
//
// Es seguro volver a correrlo: una fila cuyas 3 evidencias ya tengan ruta
// (no base64) se salta sola. Si se corta a mitad de camino, correrlo de
// nuevo retoma donde se quedo.

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { BlobServiceClient } from '@azure/storage-blob';
import { randomUUID } from 'node:crypto';

const dryRun = process.argv.includes('--dry-run');
const limiteArg = process.argv.find((a) => a.startsWith('--limite='));
const LIMITE = limiteArg ? Number(limiteArg.split('=')[1]) : Infinity;

const SCHEMA = process.env.PGSCHEMA || 'progreso';
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'evidencias-roturas';

function requerir(nombre) {
  const v = process.env[nombre];
  if (!v) {
    console.error(`Falta la variable de entorno ${nombre}.`);
    process.exit(1);
  }
  return v;
}

const supabaseUrl = requerir('SUPABASE_URL');
const supabaseKey = requerir('SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

const pool = new pg.Pool({
  host: requerir('PGHOST'),
  port: Number(process.env.PGPORT || 5432),
  database: requerir('PGDATABASE'),
  user: requerir('PGUSER'),
  password: requerir('PGPASSWORD'),
  ssl: { rejectUnauthorized: false },
});

let blobService = null;
function obtenerBlobService() {
  if (blobService) return blobService;
  blobService = BlobServiceClient.fromConnectionString(requerir('AZURE_STORAGE_CONNECTION_STRING'));
  return blobService;
}

const CAMPOS = [
  { columna: 'foto', tipo: 'suceso' },
  { columna: 'foto_conciliador', tipo: 'conciliador' },
  { columna: 'firma', tipo: 'firma' },
];

function extensionDe(dataUri) {
  const m = /^data:(image\/\w+);base64,/.exec(dataUri);
  const mime = m ? m[1] : 'image/jpeg';
  return mime === 'image/png' ? 'png' : 'jpg';
}

function bufferDe(dataUri) {
  const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

// Cache por contenido: si dos filas del mismo evento comparten exactamente
// la misma foto/firma (reporte con varios materiales), se sube una sola vez.
const cacheRutas = new Map();

async function subirYObtenerRuta(dataUri, tipo) {
  if (cacheRutas.has(dataUri)) return cacheRutas.get(dataUri);
  const ext = extensionDe(dataUri);
  const ahora = new Date();
  const ruta = `progreso/${ahora.getUTCFullYear()}/${String(ahora.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}-${tipo}.${ext}`;
  if (!dryRun) {
    const contenedor = obtenerBlobService().getContainerClient(CONTAINER);
    await contenedor.getBlockBlobClient(ruta).uploadData(bufferDe(dataUri), {
      blobHTTPHeaders: { blobContentType: ext === 'png' ? 'image/png' : 'image/jpeg' },
    });
  }
  cacheRutas.set(dataUri, ruta);
  return ruta;
}

async function main() {
  console.log(`Migracion de evidencias — esquema: ${SCHEMA}, contenedor: ${CONTAINER}${dryRun ? ' (--dry-run)' : ''}`);

  // Trae de Supabase SOLO las filas que tienen alguna evidencia en base64
  // todavia (evita traer registros completos innecesariamente).
  const { data: filas, error } = await supabase
    .from('registros')
    .select('id, foto, foto_conciliador, firma')
    .or('foto.like.data:%,foto_conciliador.like.data:%,firma.like.data:%')
    .limit(LIMITE === Infinity ? 100000 : LIMITE);
  if (error) throw error;

  console.log(`Filas con evidencia pendiente de migrar: ${filas.length}`);

  let migradas = 0;
  let saltadas = 0;
  let fallidas = 0;
  const subidas = { suceso: 0, conciliador: 0, firma: 0 };

  for (const fila of filas) {
    try {
      // Confirma que la fila ya exista en progreso (debe haberse cargado
      // con 02_registros.sql primero) y que no se haya migrado ya.
      const { rows } = await pool.query(
        `select foto, foto_conciliador, firma from ${SCHEMA}.registros where id = $1`,
        [fila.id]
      );
      if (rows.length === 0) {
        console.warn(`  [saltada] ${fila.id}: no existe en ${SCHEMA}.registros (¿ya cargaste 02_registros.sql?)`);
        saltadas++;
        continue;
      }

      const actualizaciones = {};
      for (const { columna, tipo } of CAMPOS) {
        const valorDestino = rows[0][columna];
        const valorOrigen = fila[columna];
        const yaEsRuta = valorDestino && !String(valorDestino).startsWith('data:');
        if (yaEsRuta) continue; // ya migrada
        if (typeof valorOrigen === 'string' && valorOrigen.startsWith('data:image')) {
          const ruta = await subirYObtenerRuta(valorOrigen, tipo);
          actualizaciones[columna] = ruta;
          subidas[tipo]++;
        }
      }

      if (Object.keys(actualizaciones).length === 0) {
        saltadas++;
        continue;
      }

      if (!dryRun) {
        const cols = Object.keys(actualizaciones);
        const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
        await pool.query(`update ${SCHEMA}.registros set ${set} where id = $1`, [fila.id, ...cols.map((c) => actualizaciones[c])]);
      }
      migradas++;
      if (migradas % 25 === 0) console.log(`  ...${migradas} filas migradas`);
    } catch (err) {
      console.error(`  [ERROR] ${fila.id}:`, err.message);
      fallidas++;
    }
  }

  console.log('\n— Resumen —');
  console.log(`Filas migradas: ${migradas}`);
  console.log(`Filas saltadas (ya migradas o no existen aun en progreso): ${saltadas}`);
  console.log(`Filas con error: ${fallidas}`);
  console.log(`Archivos subidos — suceso: ${subidas.suceso}, conciliador: ${subidas.conciliador}, firma: ${subidas.firma}`);
  if (dryRun) console.log('\n--dry-run: no se subio nada a Azure ni se escribio nada en Postgres.');

  await pool.end();
}

main().catch((err) => {
  console.error('Fallo general:', err);
  process.exit(1);
});
