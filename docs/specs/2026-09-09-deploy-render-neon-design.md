# Deploy en Render + Neon — diseño

**Fecha:** 2026-09-09
**Rama:** `setup-neon`
**Estado:** implementado

## Decisiones tomadas durante la implementación (deltas al diseño original)

- **Prisma 6.19.3** (no 7). Prisma 7 sacó `url = env("DATABASE_URL")` del schema
  y obliga a *driver adapters* (`prisma.config.ts` + `pg` + `new PrismaClient({ adapter })`).
  El CLI `prisma@latest` en npm apunta hoy a un RC de v8. Se eligió el estable
  más nuevo con el camino clásico (v6), que es lo que documentan las guías
  Render+Neon.
- **`VITE_API_URL` queda `sync: false`** en `render.yaml` (se pega a mano, igual
  que `DATABASE_URL`). El auto-wire con `fromService` usa `property: host` (no
  existe `property: url` para web services) y queda documentado como opción, no
  como default: un `fromService` no soportado haría fallar el *apply* entero del
  Blueprint.
- **Seam de testeo**: el readiness llama `prisma.checkConnection()` (helper en
  `src/prisma.js` que hace `SELECT 1`) en vez de `$queryRaw` inline. Motivo:
  `node:test` `mock.method` no puede interceptar `$queryRaw` (no es own property);
  sí puede con `checkConnection`.
- **`overrides: { "deepmerge-ts": "^8.0.0" }`** en `server/package.json` para
  limpiar un advisory *high* transitivo (vía `@prisma/config`, build-time).
  `npm audit` queda en 0.

## Contexto

La cátedra tiene que entrar a una URL y ver la app andando, sin correrla
local. HU-08 dejó `client/` (React + Vite en blanco) y `server/` (Express con
`GET /api/health`) como proyectos independientes que todavía **no se hablan** y
no tienen base de datos.

Esta historia junta tres cosas que el README anterior separaba en HU-09 y HU-10:

1. Bootstrap de Prisma en `server/` (mínimo, una tabla).
2. Publicar los dos servicios en Render conectados entre sí y con Neon.
3. Que las migraciones de Prisma corran **en el build del deploy**, no a mano.
4. README con runbook de recuperación y aclaración del cold start del free tier.

Todo lo que se puede versionar queda en el repo. Los **valores** de entorno
sensibles (connection string de Neon) se cargan una sola vez en el dashboard de
Render y nunca se commitean.

## Objetivos y no-objetivos

### Objetivos

- `render.yaml` (Blueprint) en la raíz define ambos servicios de forma
  reproducible: "si se cae todo", se re-sincroniza el Blueprint.
- El static site del client apunta al backend por variable de entorno
  (`VITE_API_URL`).
- El web service del server se conecta a Neon por `DATABASE_URL`.
- `prisma migrate deploy` corre como parte del `buildCommand` del server.
- Endpoint de readiness que prueba la cadena completa client -> server -> Neon
  desde la URL publicada.
- Widget mínimo en el client que muestra si el backend responde.
- README con: arquitectura, URLs, runbook de recuperación, nota de cold start,
  cómo agregar migraciones, cómo levantar local.

### No-objetivos

- No se agrega el modelo de dominio real (eso queda para la HU de schemas).
- No se agrega pantalla de Calendario ni features de negocio.
- No se agrega runner de tests al client (hoy solo tiene `oxlint`).
- CORS queda abierto (`*`); afinar orígenes queda para más adelante.
- No se automatiza la creación del proyecto Neon ni la carga del
  `DATABASE_URL` (son clicks en consolas externas; van documentados).

## Arquitectura

```
[ Navegador cátedra ]
        |
        v
[ comunero-client ]  Render Static Site   (React + Vite build -> dist/)
        |  fetch  ${VITE_API_URL}/api/health/db
        v
[ comunero-server ]  Render Web Service    (Express + Prisma, free plan)
        |  SELECT 1  vía DATABASE_URL
        v
[ Neon ]  Postgres serverless   (proyecto "comunero")
```

- **Origen distinto** entre client y server -> el server habilita CORS.
- **Free tier**: el web service se duerme tras ~15 min sin tráfico; el primer
  request después tarda ~30-50 s en despertar. No es un bug; va aclarado en el
  README y el widget del client muestra "conectando..." mientras tanto.

## Componentes

### 1. `render.yaml` (raíz del repo)

Blueprint con los dos servicios. Estructura:

```yaml
services:
  - type: web
    name: comunero-server
    runtime: node
    plan: free
    rootDir: server
    buildCommand: npm install && npx prisma migrate deploy
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        sync: false            # se pega en el dashboard, sale de Neon
      - key: NODE_VERSION
        value: "22"

  - type: web
    name: comunero-client
    runtime: static
    plan: free
    rootDir: client
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        fromService:
          type: web
          name: comunero-server
          property: url
```

- `prisma generate` no hace falta ponerlo explícito en el `buildCommand` porque
  el `postinstall` del server lo corre; igual `migrate deploy` implica que el
  client esté generado. Se deja `npm install && npx prisma migrate deploy` y el
  `postinstall` se encarga del generate.
- **Riesgo conocido:** algunas cuentas de Render no aceptan
  `fromService.property: url` para inyectar la URL completa. Fallback
  documentado en el README: cambiar ese `envVar` a `sync: false` y pegar la URL
  del backend (`https://comunero-server.onrender.com`) a mano en el dashboard
  del static site, y redeploy.
- `DATABASE_URL` con `sync: false` -> el build del server **falla fuerte** si no
  está cargada. Es lo que queremos: no arranca sin base.

### 2. Prisma en `server/`

**`server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model HealthCheck {
  id        Int      @id @default(autoincrement())
  checkedAt DateTime @default(now())
}
```

`HealthCheck` es una tabla trivial cuyo único fin es que exista **una migración
real** que `prisma migrate deploy` aplique en el build. El endpoint de readiness
no la usa (hace `SELECT 1`), pero su presencia prueba que las migraciones
corrieron contra Neon.

**Migración inicial** — se autora sin conexión a base:

```bash
cd server
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_init/migration.sql
```

- `<timestamp>` con formato Prisma: `YYYYMMDDHHMMSS_init`.
- Se agrega `server/prisma/migrations/migration_lock.toml` con
  `provider = "postgresql"`.
- El SQL esperado crea la tabla `HealthCheck` con su secuencia y PK.

**`server/src/prisma.js`**

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
```

Instancia única, importada donde haga falta.

### 3. Rutas del server

- **`server/src/routes/health.js`** — sin cambios. `GET /` -> `{ status: 'ok' }`,
  no toca base. Es lo que usa `healthCheckPath` de Render (liveness): tiene que
  responder aunque la base esté lenta o caída.
- **`server/src/routes/healthDb.js`** — nuevo. `GET /`:
  - corre `await prisma.$queryRaw\`SELECT 1\``
  - éxito -> `200 { status: 'ok', db: 'ok' }`
  - error -> loguea el error (server-side), responde `503 { status: 'ok', db: 'error' }`
- **`server/src/index.js`** — agrega `app.use(cors())` (abierto) y
  `app.use('/api/health/db', healthDbRoutes)`.

### 4. `server/package.json`

- `dependencies`: `+ @prisma/client`, `+ cors`
- `devDependencies`: `+ prisma`
- `scripts`:
  - `postinstall`: `prisma generate`
  - `migrate:deploy`: `prisma migrate deploy`
  - `migrate:dev`: `prisma migrate dev`

Versiones: las más nuevas disponibles al implementar (Prisma 6.x, cors 2.x).
Node 22 ya fijado por `.nvmrc` y `NODE_VERSION` en Render.

### 5. Client

- **`client/.env.example`** — nuevo:
  ```
  VITE_API_URL=http://localhost:3000
  ```
- **`client/src/lib/api.js`** — nuevo:
  ```js
  export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
  ```
- **`client/src/App.jsx`** — reemplaza el boilerplate de Vite por un componente
  `BackendStatus`:
  - `useEffect` en mount: `fetch(\`${API_URL}/api/health/db\`)`
  - estados: `loading` -> "conectando con el backend...",
    `ok` -> "backend ok", `error` -> "sin conexión con el backend"
  - marcado y estilos mínimos; `App.css` se recorta a lo que use el componente.
  - Los assets viejos (`hero.png`, `react.svg`, `vite.svg`) quedan en el repo
    pero sin importar.
- **`client/.gitignore`** ya ignora `*.local`, cubre `.env*.local`. El
  `.env.example` sí se versiona.

### 6. README

Reescribe las secciones "Neon" y "Render" (y la nota de que "no están
conectados"). Contenido nuevo:

- **Arquitectura**: el diagrama de arriba en versión corta + las tres URLs
  (placeholders para completar: static site, web service, Neon console).
- **Runbook "si se cae todo"**:
  1. **Neon**: console.neon.tech -> proyecto `comunero` -> Connection Details ->
     copiar la connection string *pooled* (`...-pooler...`, `?sslmode=require`).
  2. **Render**: Dashboard -> New -> **Blueprint** -> elegir este repo -> Render
     lee `render.yaml` y crea/actualiza los dos servicios.
  3. En `comunero-server` -> Environment -> pegar `DATABASE_URL` con la string
     de Neon -> Save -> se dispara un deploy; el build corre
     `prisma migrate deploy` contra Neon.
  4. *(Solo si Render no aceptó `property: url`)*: en `comunero-client` ->
     Environment -> `VITE_API_URL` = URL del server -> Save -> redeploy.
  5. **Verificar**:
     ```bash
     curl https://comunero-server.onrender.com/api/health      # -> {"status":"ok"}
     curl https://comunero-server.onrender.com/api/health/db    # -> {"status":"ok","db":"ok"}
     ```
     y abrir la URL del client -> debe decir "backend ok".
- **Cold start**: el web service free se duerme tras ~15 min sin uso; el primer
  request tarda ~30-50 s en despertarlo. El widget muestra "conectando..." ese
  rato. No está roto.
- **Migraciones**: corren solas en el build (`buildCommand` del server). Para
  agregar una nueva:
  ```bash
  cd server
  npx prisma migrate dev --name <nombre>   # contra un branch de Neon
  git add prisma/migrations
  ```
- **Local dev**: ahora el server necesita `DATABASE_URL`. Usar un **branch de
  Neon** para desarrollo (Neon Console -> Branches -> New branch) y poner esa
  string en `server/.env`. Luego `npm run migrate:deploy` (o `migrate:dev`).

## Flujo de datos

1. La cátedra abre la URL del static site.
2. `App.jsx` monta, lee `VITE_API_URL` (inyectada en build time por Render).
3. `fetch(${VITE_API_URL}/api/health/db)`.
4. El server recibe el request, corre `SELECT 1` vía Prisma sobre Neon.
5. Responde `{ status: 'ok', db: 'ok' }`.
6. El widget pinta "backend ok".

Si el server estaba dormido, el paso 3 tarda ~30-50 s (cold start) y el widget
queda en "conectando...".

## Manejo de errores

| Caso | Comportamiento |
| --- | --- |
| `DATABASE_URL` no seteada en Render | `prisma migrate deploy` falla -> el deploy del server falla (visible en logs). Intencional. |
| Neon caído / string mal | `/api/health/db` -> `503 { db: 'error' }`, error logueado server-side. `/api/health` sigue `200`. Widget: "sin conexión con el backend". |
| Server dormido (cold start) | `/api/health` y `/api/health/db` tardan; widget en "conectando..." hasta que responde. |
| `property: url` no soportado | `VITE_API_URL` queda sin valor -> `api.js` cae al default `localhost:3000` -> fetch falla en prod. Se resuelve con el paso 4 del runbook. |
| CORS | `app.use(cors())` abierto; cualquier origen puede llamar. Aceptado para el TP. |

## Testing

### Server (`node:test`, sin base real)

- `server/test/health.test.js` — se mantiene tal cual (liveness no cambió).
- `server/test/health-db.test.js` — nuevo:
  - mock de `prisma.$queryRaw` con `mock.method(...)`:
    - devuelve `[{ '?column?': 1 }]` -> espera `200` y `{ db: 'ok' }`.
    - lanza -> espera `503` y `{ db: 'error' }`.
  - usa `supertest` sobre `app` (ya importable sin `listen`).

### Verificación manual / comandos

- `cd server && npx prisma validate` — schema válido.
- Revisar a mano el `migration.sql` generado: debe crear la tabla `HealthCheck`
  (id serial PK, `checkedAt` con default). El chequeo de drift con shadow DB
  (`prisma migrate diff --from-migrations`) necesita conexión y lo corre quien
  hace el deploy; offline alcanza con `validate` + lectura del SQL.
- `cd server && npm test` — verde.
- `cd client && npm run build` — compila.
- `cd client && npm run lint` — sin errores.

### Post-deploy (lo corre quien hace el deploy)

- `curl .../api/health` -> `{"status":"ok"}`
- `curl .../api/health/db` -> `{"status":"ok","db":"ok"}`
- Abrir la URL del client -> "backend ok".
- Confirmar en Neon que existe la tabla `HealthCheck` (migración aplicada).

## Archivos tocados

**Nuevos**
- `render.yaml`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/<ts>_init/migration.sql`
- `server/prisma/migrations/migration_lock.toml`
- `server/src/prisma.js`
- `server/src/routes/healthDb.js`
- `server/test/health-db.test.js`
- `client/.env.example`
- `client/src/lib/api.js`

**Modificados**
- `server/package.json` (deps + scripts)
- `server/src/index.js` (cors + montar `/api/health/db`)
- `server/.env.example` (nota sobre branch de Neon para local)
- `client/src/App.jsx` (widget `BackendStatus`)
- `client/src/App.css` (recorte)
- `README.md` (secciones Neon / Render / arquitectura / runbook / cold start)

## Commits

Los hace el usuario, por separado. Esta rama es `setup-neon`. Sugerencia de
recorte (no vinculante):

1. `chore(server): bootstrap Prisma con tabla HealthCheck y migración inicial`
2. `feat(server): readiness /api/health/db + CORS`
3. `feat(client): widget de estado del backend por VITE_API_URL`
4. `feat: render.yaml (Blueprint) para client y server`
5. `docs: README con runbook de deploy, migraciones en build y cold start`
