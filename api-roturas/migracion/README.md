# Migración de datos — App de Roturas · CD

Export real de la base de Supabase del piloto (corte: fecha de generación de estos
archivos), listo para cargar en `progreso.usuarios` y `progreso.registros` una vez
Tecnología entregue los 4 habilitadores (esquema, identidad técnica, conectividad,
secretos — ver el informe técnico en `Documentación/`).

## Contenido

| Archivo | Filas | Qué es |
|---|---|---|
| `01_usuarios.sql` | 13 | Cuentas del piloto (nombre, usuario, rol, activo) |
| `02_registros.sql` | 604 | Todas las roturas reportadas hasta el corte |

## ⚠️ Qué se excluyó a propósito, y por qué

- **Contraseñas reales.** Cada fila de `01_usuarios.sql` trae la contraseña reemplazada
  por el texto `CAMBIAR_ESTA_CONTRASENA`. Las contraseñas originales del piloto se
  guardaban en texto plano — subirlas tal cual a un repositorio (aunque sea privado)
  es un riesgo de seguridad innecesario. **Antes de dar por cerrado el corte, alguien
  con acceso a la base debe entrar y poner una contraseña real a cada usuario** (o,
  mejor, aprovechar el corte para empezar a guardarlas con hash en vez de texto plano).

- **Fotos, foto del conciliador y firma.** `registros` normalmente tiene esas tres
  columnas en base64 (pueden pesar varios MB cada una) — no están en este SQL. Según
  el informe técnico, en el esquema nuevo esas columnas van a guardar una **ruta
  relativa** a un archivo en la nube corporativa, no la imagen — así que estos
  registros quedan con esas tres columnas vacías tras la carga inicial y **hay que
  migrar las imágenes por separado** con un script que las suba a Azure Blob Storage y
  llene esas rutas (no incluido aquí — se hace una vez exista la cadena de conexión
  real de almacenamiento).

## Cómo cargarlo

Una vez tengas la conexión real a `progreso` (y las tablas ya confirmadas por
Tecnología, ver §3 del informe técnico — ya existen, no hay que crearlas):

```bash
psql "$CONNECTION_STRING" -f 01_usuarios.sql
psql "$CONNECTION_STRING" -f 02_registros.sql
```

Los `insert ... on conflict do nothing` hacen que sea seguro volver a correrlos si algo
falla a mitad de camino — no van a duplicar filas.
