# Totales de control — migración App de Roturas · CD

Corte del export: ver fecha de commit de este archivo en git.

## Origen (Supabase, `public`)

| Tabla | Filas en origen | Con evidencia base64 pendiente |
|---|---|---|
| `usuarios` | 13 | — (no aplica) |
| `registros` | 604 | 4 filas (`foto`/`foto_conciliador`/`firma` con imagen real; el resto del piloto no tiene evidencia real capturada) |

## Archivos generados

| Archivo | Filas que inserta |
|---|---|
| `01_usuarios.sql` | 13 |
| `02_registros.sql` | 604 |

## Cómo reconciliar después de cargar

Una vez corridos `01_usuarios.sql` y `02_registros.sql` contra `progreso`, confirma que
coincidan estos conteos:

```sql
select count(*) from progreso.usuarios;    -- debe dar 13
select count(*) from progreso.registros;   -- debe dar 604
```

Y después de correr `migrar-evidencias.mjs` (sin `--dry-run`):

```sql
select count(*) from progreso.registros
where (foto like 'data:%') or (foto_conciliador like 'data:%') or (firma like 'data:%');
-- debe dar 0 — ninguna fila debe seguir con base64 en Postgres
```

Si algún número no coincide, **no continúes con el corte** — revisa el log del script de
migración (imprime cada fila que falla) antes de seguir.
