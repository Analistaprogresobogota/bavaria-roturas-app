// Convierte el build de Vite (dist/index.html + dist/assets/*) en un solo
// archivo HTML autocontenido, sin referencias externas a archivos locales.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(raiz, 'dist');
const rutaHtml = join(distDir, 'index.html');

let html = readFileSync(rutaHtml, 'utf-8');

html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/,
  (_m, rel) => `<style>\n${readFileSync(join(distDir, rel), 'utf-8')}\n</style>`
);

html = html.replace(
  /<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/,
  (_m, rel) => `<script type="module">\n${readFileSync(join(distDir, rel), 'utf-8')}\n</script>`
);

html = html.replace(/<link rel="icon"[^>]*href="\.\/(favicon\.svg)"[^>]*\/?>/, (_m, rel) => {
  const svg = readFileSync(join(distDir, rel), 'utf-8');
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return `<link rel="icon" type="image/svg+xml" href="${dataUri}" />`;
});

writeFileSync(rutaHtml, html);
console.log('dist/index.html ahora es un archivo autocontenido.');
