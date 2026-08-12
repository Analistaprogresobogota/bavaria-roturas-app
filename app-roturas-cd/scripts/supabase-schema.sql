-- Esquema para el proyecto Supabase de "App de Roturas · CD".
-- Pegar y correr en: Supabase Dashboard -> SQL Editor -> New query.
-- Es seguro volver a correrlo (usa "if not exists" / "drop policy if exists").
--
-- Solo 2 tablas, como se pidio:
--   1) usuarios  -> login + rol de TODO el personal (operativo, supervisor, admin)
--   2) registros -> una fila por rotura reportada (mismos campos del HTML original)
--
-- Los datos maestros (187 materiales, 39 causales, ubicaciones, turnos) NO
-- van en Supabase: son datos que casi no cambian y quedan embebidos en la
-- app (src/datos/maestros.js), igual que el proyecto de Rotadores.

-- ============================== USUARIOS ==============================
create table if not exists usuarios (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  usuario text not null unique,
  password text not null,
  rol text not null check (rol in ('operativo', 'supervisor', 'admin')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

comment on table usuarios is
  'Login local de la app (usuario/contrasena en texto plano, como el resto de este piloto): no es seguridad real, la proteccion real es RLS + que el APK/exe no se comparte fuera del personal autorizado. Sirve para identificar quien reporta/revisa/administra.';

-- ============================== REGISTROS ==============================
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
  descripcion text default 'Sin Observación',
  reportante text not null,
  reportante_usuario_id text references usuarios(id) on delete set null,
  supervisor1 text,
  supervisor2 text,
  conciliador text,
  opm text,
  foto text,
  foto_conciliador text,
  sede text default 'Progreso'
);

comment on column registros.foto is
  'Foto del suceso, redimensionada en el celular antes de guardar (maximo ~1280px, JPEG) y codificada como data URI base64. Se guarda directo en la fila (no en Supabase Storage) para mantener el esquema en solo 2 tablas.';

alter table usuarios enable row level security;
alter table registros enable row level security;

drop policy if exists "anon all usuarios" on usuarios;
drop policy if exists "anon all registros" on registros;

-- Igual que el proyecto de Rotadores: la clave anon puede leer/escribir todo.
-- La proteccion real de "quien puede hacer que" vive en la UI segun el rol
-- guardado en la sesion (login contra esta misma tabla usuarios).
create policy "anon all usuarios" on usuarios for all using (true) with check (true);
create policy "anon all registros" on registros for all using (true) with check (true);

-- Tiempo real: para que el Tablero del supervisor/admin se actualice solo
-- cuando alguien reporta una rotura desde otro dispositivo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registros'
  ) then
    alter publication supabase_realtime add table public.registros;
  end if;
end $$;

create index if not exists registros_fecha_idx on registros (fecha desc);
create index if not exists registros_ubicacion_idx on registros (ubicacion);
create index if not exists usuarios_usuario_idx on usuarios (usuario);
