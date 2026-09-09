# Comunero

Monorepo del TP. Dos proyectos independientes:

| Carpeta    | Qué es                        | Levanta en             |
| ---------- | ----------------------------- | ---------------------- |
| `client/`  | React + Vite (JS)             | http://localhost:5173  |
| `server/`  | API Express + ruta `/api/health` | http://localhost:3000  |

Todavía **no están conectados entre sí**. La base de datos (Neon) y los servicios
de deploy (Render) están creados pero vacíos. Conectar todo de verdad (migraciones
en el build, envs de Render apuntando a Neon) es **HU-10**. Los schemas y el ORM
los suma **HU-09**.

---

## Requisitos

- **Node 22 LTS** (hay un `.nvmrc` en la raíz).
  ```bash
  nvm install    # instala la versión del .nvmrc
  nvm use
  ```
- npm (viene con Node).

---

## Levantar en local

### Client

```bash
cd client
npm install
npm run dev
```

Abre http://localhost:5173 → pantalla en blanco de Vite.

Otros scripts: `npm run build` (genera `client/dist/`), `npm run preview`, `npm run lint`.

### Server

```bash
cd server
cp .env.example .env      # completá los valores reales (ver "Variables de entorno")
npm install
npm run dev               # node --watch, reinicia al guardar
```

Probar el health check:

```bash
curl http://localhost:3000/api/health
# -> {"status":"ok"}
```

Otros scripts: `npm start` (sin watch), `npm test` (test del health check con el runner nativo de Node).

---

## Variables de entorno

Solo el `server/` usa variables de entorno.

1. `cp server/.env.example server/.env`
2. Completá:

   | Variable       | De dónde sale                                                             |
   | -------------- | ------------------------------------------------------------------------- |
   | `DATABASE_URL` | Connection string del proyecto Neon (ver abajo).                         |
   | `PORT`         | Puerto local. Default `3000`. En Render lo inyecta la plataforma.        |

`server/.env` está en `.gitignore` y **no se commitea**. El que sí se versiona es
`server/.env.example` (con placeholders, sin valores reales).

---

## Neon (base de datos)

- **Dónde**: https://console.neon.tech — login con la cuenta del equipo.
- **Proyecto**: `comunero` (Postgres, región por defecto). Base creada y **vacía**
  (sin tablas hasta HU-09).

### Cómo crear el proyecto (si todavía no existe)

1. Entrar a https://console.neon.tech y hacer login.
2. **New Project** → Name: `comunero` → Postgres version por defecto → **Create**.
3. En **Connection Details**, copiar la **Connection string** (formato
   `postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`).
4. Pegarla como `DATABASE_URL` en `server/.env` (local) y guardarla para cargarla
   después en Render (HU-10). **No commitear ese valor.**

---

## Render (deploy)

- **Dónde**: https://dashboard.render.com — login con la cuenta del equipo.
- Dos servicios, ambos apuntando a este repo. Todavía **no tienen nada real** ni
  variables conectadas (eso es HU-10).

### Cómo crear los servicios (si todavía no existen)

**1. Static Site para el client**

1. Dashboard → **New** → **Static Site** → conectar este repositorio.
2. Config:
   - **Name**: `comunero-client`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `client/dist`
3. **Create Static Site**.

**2. Web Service para el server**

1. Dashboard → **New** → **Web Service** → mismo repositorio.
2. Config:
   - **Name**: `comunero-server`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. En **Environment**, agregar `DATABASE_URL` con la connection string de Neon
   (esto se completa en HU-10; se puede dejar vacío por ahora).
4. **Create Web Service**.

---

## Estructura

```
Comunero/
├── .gitignore
├── .nvmrc
├── README.md
├── client/                 # React + Vite
│   └── src/
└── server/
    ├── .env.example
    └── src/
        ├── index.js         # crea la app, monta /api/health, listen(PORT)
        └── routes/
            └── health.js    # GET / -> { status: "ok" }
```
