// Sube usuarios de prueba (uno por rol) y los registros historicos de
// ejemplo (los mismos ~45 del prototipo original) al proyecto Supabase.
// Se puede correr varias veces: usuarios usa upsert por "usuario"; registros
// solo se sube si la tabla esta vacia (para no duplicar cada vez que se corre).
//
// Uso:
//   SUPABASE_URL=https://tu-proyecto.supabase.co \
//   SUPABASE_ANON_KEY=tu-clave-anon \
//   node scripts/seed-supabase.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Falta SUPABASE_URL y/o SUPABASE_ANON_KEY en el entorno.');
  process.exit(1);
}

const supabase = createClient(url, key);

const USUARIOS_DEMO = [
  { nombre: 'Administrador Piloto', usuario: 'admin', password: 'admin2026', rol: 'admin' },
  { nombre: 'Cristian Henriquez', usuario: 'supervisor', password: 'bavaria2026', rol: 'supervisor' },
  { nombre: 'Wilson Vera', usuario: 'operativo', password: '1234', rol: 'operativo' },
];

async function seedUsuarios() {
  const { error } = await supabase.from('usuarios').upsert(USUARIOS_DEMO, { onConflict: 'usuario' });
  if (error) throw error;
  console.log(`usuarios: ${USUARIOS_DEMO.length} cuentas de prueba listas (admin/supervisor/operativo).`);
}

async function seedRegistros() {
  const { count, error: errCount } = await supabase
    .from('registros')
    .select('id', { count: 'exact', head: true });
  if (errCount) throw errCount;
  if (count > 0) {
    console.log(`registros: ya hay ${count} filas, no se vuelve a sembrar.`);
    return;
  }
  const filas = JSON.parse(readFileSync(join(raiz, 'scripts', 'seed-registros.json'), 'utf-8'));
  const { error } = await supabase.from('registros').insert(filas);
  if (error) throw error;
  console.log(`registros: ${filas.length} filas historicas de ejemplo insertadas.`);
}

await seedUsuarios();
await seedRegistros();
console.log('Listo.');
