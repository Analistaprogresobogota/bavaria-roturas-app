-- Migracion v3: soluciona el "canceling statement due to statement
-- timeout" que aparece en Registros/Tablero cuando la tabla ya tiene
-- muchas filas con fotos y firma en base64.
--
-- Causa: la app traia TODAS las columnas (incluidas foto, foto_conciliador
-- y firma, que pueden pesar cientos de KB cada una) cada vez que se abria
-- Registros o el Tablero -- con 100+ filas eso son varios MB en una sola
-- consulta, y Supabase la cancela por demorarse demasiado.
--
-- Solucion: 3 columnas generadas (boolean, casi no pesan) para saber si
-- una fila TIENE foto/firma sin tener que traer la imagen completa. La app
-- ahora solo trae la imagen completa cuando se abre el detalle de UN
-- registro puntual.
--
-- Pegar y correr en: Supabase Dashboard -> SQL Editor -> New query.
-- Es seguro volver a correrla.

alter table registros add column if not exists tiene_foto boolean generated always as (foto is not null and foto <> '') stored;
alter table registros add column if not exists tiene_foto_conciliador boolean generated always as (foto_conciliador is not null and foto_conciliador <> '') stored;
alter table registros add column if not exists tiene_firma boolean generated always as (firma is not null and firma <> '') stored;
