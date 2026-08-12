# api-roturas

API intermedia entre el aplicativo **App de Roturas · CD** y la base de datos Postgres de Tecnología (Azure Database for PostgreSQL). Reemplaza a Supabase: el aplicativo le habla a esta API por HTTP, y esta API es la única que se conecta directamente a la base de datos.

```
App de Roturas (Android / Windows / macOS)
        │  HTTPS
        ▼
   api-roturas  (este proyecto)
        │  conexión Postgres (host/puerto/usuario/contraseña)
        ▼
Base de datos "dbgroot" en Azure
```

## Por qué existe

El aplicativo no puede conectarse directo a la base de datos: ni el navegador ni el APK/exe pueden hablar el protocolo de Postgres, y aunque pudieran, sería un riesgo grave guardar la contraseña de la base dentro de una app instalada en varios dispositivos. Esta API hace de intermediario: recibe peticiones HTTP normales del aplicativo y es la única que usa las credenciales reales de la base de datos.

## 1. Preparar la base de datos (una sola vez)

Conectarse a la base `dbgroot` (por ejemplo con DBeaver) y correr el contenido de [`schema.sql`](./schema.sql). Es seguro volver a correrlo si hace falta — usa `if not exists`.

Crea 2 tablas: `usuarios` (login y rol de cada persona) y `registros` (una fila por rotura reportada). El detalle completo de cada columna está en el documento `Documentación/Aplicativo 1 - Base de datos - Especificacion para Tecnologia.docx`, en la carpeta raíz de este proyecto.

## 2. Configurar y correr la API

Requiere Node.js 18 o superior.

```bash
cd api-roturas
npm install
cp .env.example .env
```

Completar `.env` con los datos reales de conexión (host, usuario, contraseña, nombre de la base — los mismos que usan en DBeaver):

```
PGHOST=svr-dba-ienm.postgres.database.azure.com
PGPORT=5432
PGDATABASE=dbgroot
PGUSER=userprog
PGPASSWORD=<la contraseña real>
PORT=3001
CORS_ORIGIN=*
```

Correr:

```bash
npm start
```

Debe imprimir `API de Roturas escuchando en el puerto 3001`. Para confirmar que sí llega a la base de datos:

```bash
curl http://localhost:3001/salud
# esperado: {"estado":"ok","base_de_datos":"conectada"}
```

## 3. Firewall de Azure

Azure Database for PostgreSQL bloquea por IP. Hay que agregar, en las reglas de firewall de la base `dbgroot`, la IP pública desde donde va a correr esta API en producción (el servidor/App Service/contenedor donde la desplieguen) — no solo la IP de quien la desarrolla.

## 4. Desplegarla en un servidor real

Esto lo define Tecnología según su infraestructura en Azure — opciones típicas:

- **Azure App Service** (Node.js) — la más simple, sube este proyecto y define las mismas variables de entorno del `.env` en la configuración de la App Service.
- **Azure Container Apps / AKS** — si prefieren correrla en un contenedor Docker.
- **Azure Functions** — es posible, pero requeriría adaptar las rutas al formato de Functions; no es necesario para el piloto.

La API debe quedar accesible por una URL HTTPS pública o interna (ej. `https://api-roturas.empresa.com`), que es la que luego se configura en el aplicativo (`VITE_API_URL`, ver `.env.example` del proyecto `app-roturas-cd`).

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/salud` | Verifica que la API está viva y conectada a la base de datos. |
| GET | `/registros` | Lista de registros (sin foto/firma, columnas livianas). |
| GET | `/registros/:id` | Un registro completo, con foto, foto_conciliador y firma. |
| POST | `/registros` | Crea un registro nuevo. |
| DELETE | `/registros/:id` | Elimina un registro. |
| GET | `/registros/eventos` | Server-Sent Events: avisa a la app cuando algo cambió, para refrescar en vivo (reemplaza el "tiempo real" de Supabase). |
| GET | `/usuarios` | Lista de cuentas. |
| POST | `/usuarios/login` | Valida usuario/contraseña (la comparación pasa en el servidor, nunca se envían las contraseñas al dispositivo). |
| POST | `/usuarios` | Crea una cuenta nueva. |
| PATCH | `/usuarios/:id` | Cambia rol, estado activo, etc. |

## Nota sobre esto siendo un "piloto→producción"

Esta API queda pensada para vivir dentro de la infraestructura de Tecnología (junto a la base de datos), no como algo que dependa de un plan gratuito de otro proveedor — es la pieza que permite que el aplicativo deje de depender de Supabase y pase a ser la solución definitiva.
