# Comunero

Monorepo del TP.

| Carpeta   | Qué es                                   | Local                  |
| --------- | ---------------------------------------- | ---------------------- |
| `client/` | React + Vite (JS)                        | http://localhost:5173  |
| `server/` | API Express + Prisma (`/api/health*`)    | http://localhost:3000  |

Los dos están **publicados en Render** y conectados: el client pega al server por
variable de entorno, y el server pega a **Neon** (Postgres) por `DATABASE_URL`.
Las migraciones de Prisma corren solas en el build del deploy.

## URLs

| Qué                | URL                                             |
| ------------------ | ----------------------------------------------- |
| Client (static)    | `https://comunero-client.onrender.com`  *(completar)* |
| Server (API)       | `https://comunero-server.onrender.com`  *(completar)* |
| Neon console       | https://console.neon.tech (proyecto `comunero`) |
| Render dashboard   | https://dashboard.render.com                    |

### Arquitectura

```
Navegador  ──►  comunero-client (Render Static Site, build de Vite)
                     │  fetch  ${VITE_API_URL}/api/health/db
                     ▼
               comunero-server (Render Web Service, Express + Prisma, free)
                     │  SELECT 1  vía DATABASE_URL
                     ▼
                  Neon  (Postgres serverless, proyecto "comunero")
```

> **Cold start (free tier):** el web service se duerme tras ~15 min sin tráfico.
> El primer request después tarda **~30–50 s** en despertarlo; el client muestra
> "conectando con el backend…" ese rato. **No está roto**, es el plan gratis.

---

## Requisitos

- **Node 22** (hay un `.nvmrc` en la raíz).
  ```bash
  nvm install    # instala la versión del .nvmrc
  nvm use
  ```
- npm (viene con Node).

---

## Levantar en local

### Server

```bash
cd server
cp .env.example .env      # completá DATABASE_URL (ver "Variables de entorno")
npm install
npm run migrate:deploy    # aplica las migraciones de Prisma en tu base
npm run dev               # node --watch, reinicia al guardar
```

Probar los health checks:

```bash
curl http://localhost:3000/api/health      # -> {"status":"ok"}            (liveness, no toca la base)
curl http://localhost:3000/api/health/db   # -> {"status":"ok","db":"ok"}  (readiness, hace SELECT 1)
```

Otros scripts: `npm start` (sin watch), `npm test` (runner nativo de Node),
`npm run migrate:dev` (crear una migración nueva).

### Client

```bash
cd client
cp .env.example .env      # VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

Abre http://localhost:5173 → muestra el estado de conexión con el backend.

Otros scripts: `npm run build` (genera `client/dist/`), `npm run preview`,
`npm run lint`.

---

## Variables de entorno

Ninguna está hardcodeada en el repo. Los `.env` reales no se commitean; sí se
versionan los `.env.example` (con placeholders).

| Servicio | Variable       | De dónde sale                                                        |
| -------- | -------------- | ------------------------------------------------------------------- |
| server   | `DATABASE_URL` | Connection string de Neon. Local: un **branch** de Neon (ver abajo). Render: se pega en el dashboard. |
| server   | `PORT`         | Puerto local, default `3000`. En Render lo inyecta la plataforma.   |
| client   | `VITE_API_URL` | URL base del server. Local: `http://localhost:3000`. Render: se pega en el dashboard del static site. |

---

## Neon (base de datos)

- **Dónde**: https://console.neon.tech — login con la cuenta del equipo.
- **Proyecto**: `comunero` (Postgres, región por defecto).
- El esquema lo maneja Prisma (`server/prisma/`). Por ahora una sola tabla
  (`HealthCheck`), suficiente para que exista una migración real que el deploy
  aplique.

### Crear el proyecto (si no existe)

1. https://console.neon.tech → login.
2. **New Project** → Name: `comunero` → Postgres por defecto → **Create**.
3. **Connection Details** → copiar la **Connection string**
   (`postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`).

### Branch para desarrollo local

No trabajes local contra la base que usa el deploy. En Neon Console →
**Branches** → **New branch** (ej. `dev`) → copiá su connection string y ponela
como `DATABASE_URL` en `server/.env`.

### Migraciones

- **En el deploy**: automáticas. El build del server corre `prisma migrate deploy`
  antes de levantar Express (ver `render.yaml`).
- **Crear una nueva** (local, contra tu branch):
  ```bash
  cd server
  npx prisma migrate dev --name <nombre>
  git add prisma/migrations   # se commitea
  ```

---

## Render (deploy)

- **Dónde**: https://dashboard.render.com — login con la cuenta del equipo.
- La infra está declarada en **`render.yaml`** (Blueprint) en la raíz: define los
  dos servicios, sus build/start commands y qué variables espera. Los **valores**
  sensibles (`DATABASE_URL`, `VITE_API_URL`) se cargan a mano en el dashboard,
  nunca en el repo.

### Runbook — "si se cae todo" / desde cero

1. **Neon**: tener el proyecto `comunero` y a mano su connection string
   (Connection Details → *pooled connection* si está disponible, con
   `?sslmode=require`).

2. **Render → Blueprint**: Dashboard → **New** → **Blueprint** → elegir este
   repositorio → Render lee `render.yaml` y crea/actualiza `comunero-server` y
   `comunero-client`. Al aplicar te pide los valores de las variables marcadas
   `sync: false`.

3. **`DATABASE_URL`** en `comunero-server` → Environment → pegar la connection
   string de Neon → **Save**. Se dispara un deploy; el build corre
   `prisma migrate deploy` contra Neon (mirá los logs: deben verse las
   migraciones aplicadas).

4. **`VITE_API_URL`** en `comunero-client` → Environment → pegar la URL pública
   del server (ej. `https://comunero-server.onrender.com`) → **Save** →
   **Manual Deploy** (Vite resuelve la variable en build time, así que hay que
   rebuildear).

5. **Verificar**:
   ```bash
   curl https://comunero-server.onrender.com/api/health      # -> {"status":"ok"}
   curl https://comunero-server.onrender.com/api/health/db    # -> {"status":"ok","db":"ok"}
   ```
   Abrir la URL del client → debe decir **"backend ok"**.
   (Si el server estaba dormido, el primer curl tarda ~30–50 s.)

### Notas

- **Connection string de Neon**: la que muestra la consola es la *pooled*
  (`...-pooler...`). Sirve para todo, incluido `prisma migrate deploy`. Si
  alguna vez una migración falla en el pooler, agregá en `schema.prisma`
  `directUrl = env("DIRECT_URL")` y una env var `DIRECT_URL` con la misma
  string **sin** `-pooler` en el host (conexión directa).
- **Auto-deploy**: cada push a `main` redeploya ambos servicios.
- **CORS**: el server responde con CORS abierto (`app.use(cors())`), así el
  static site puede pegarle desde su propio origen.
- **Auto-wire opcional**: si tu cuenta de Render lo soporta, `VITE_API_URL` se
  puede tomar del server con `fromService` en vez de pegarla a mano (ver
  comentario en `render.yaml`).

---

## Estructura

```
Comunero/
├── .nvmrc
├── render.yaml               # Blueprint: define los dos servicios de Render
├── README.md
├── client/                   # React + Vite
│   ├── .env.example          # VITE_API_URL
│   └── src/
│       ├── App.jsx           # widget: estado de conexión con el backend
│       └── lib/api.js        # API_URL desde import.meta.env.VITE_API_URL
└── server/
    ├── .env.example          # DATABASE_URL, PORT
    ├── prisma/
    │   ├── schema.prisma     # datasource Postgres + modelo HealthCheck
    │   └── migrations/       # se aplican con `prisma migrate deploy` en el build
    └── src/
        ├── index.js          # crea la app, CORS, monta /api/health*, listen(PORT)
        ├── prisma.js         # PrismaClient singleton + checkConnection()
        └── routes/
            ├── health.js     # GET /api/health     -> { status: "ok" }        (liveness)
            └── healthDb.js   # GET /api/health/db  -> { status, db }  200/503 (readiness)
```
