-- Esquema de base de datos para "App de Roturas · CD", adaptado para
-- correr en un Postgres propio (Azure Database for PostgreSQL), sin
-- depender de nada especifico de Supabase.
--
-- Es seguro volver a correrlo (usa "if not exists").
-- Ejecutar UNA vez, conectado a la base "dbgroot", antes de arrancar la API.

create extension if not exists pgcrypto;

create table if not exists usuarios (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  usuario text not null unique,
  password text not null,
  rol text not null check (rol in ('operativo', 'supervisor', 'admin')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists registros (
  id text primary key default gen_random_uuid()::text,
  creado_en timestamptz not null default now(),
  fecha date not null,
  turno text not null,
  ubicacion text not null,
  material text not null,
  cantidad numeric not null default 0,
  causal_codigo text,
  causal_label text,
  causal_categoria text,
  estado_e text,
  descripcion text default 'Sin Observación',
  reportante text not null,
  reportante_usuario_id text references usuarios(id) on delete set null,
  supervisor1 text,
  supervisor2 text,
  conciliador text,
  opm text,
  foto text,
  foto_conciliador text,
  firma text,
  sede text default 'Progreso',
  tiene_foto boolean generated always as (foto is not null and foto <> '') stored,
  tiene_foto_conciliador boolean generated always as (foto_conciliador is not null and foto_conciliador <> '') stored,
  tiene_firma boolean generated always as (firma is not null and firma <> '') stored
);

create index if not exists registros_fecha_idx on registros (fecha desc);
create index if not exists registros_ubicacion_idx on registros (ubicacion);
create index if not exists usuarios_usuario_idx on usuarios (usuario);
