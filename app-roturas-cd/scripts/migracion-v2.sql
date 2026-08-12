-- Migracion v2: agrega 2 columnas nuevas a "registros" para los ajustes
-- pedidos (campo Estado despues de Causal, y firma electronica).
-- Pegar y correr en: Supabase Dashboard -> SQL Editor -> New query.
-- Es seguro volver a correrla (usa "if not exists").

alter table registros add column if not exists estado_e text;
alter table registros add column if not exists firma text;

comment on column registros.estado_e is
  'Clasificacion posterior a Causal: E1, E2, E3, E4 o "Conciliación Z71".';
comment on column registros.firma is
  'Firma electronica de quien reporta (trazo dibujado), PNG en base64 - obligatoria al guardar, igual que la foto del suceso.';
