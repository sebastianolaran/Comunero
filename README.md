# Comunero

Monorepo del TP.

| Carpeta   | Qué es                                | Local                  |
| --------- | -------------------------------------- | ---------------------- |
| `client/` | React + Vite (JS)                      | http://localhost:5173  |
| `server/` | API Express + Prisma (`/api/health*`)  | http://localhost:3000  |

Los dos están publicados en Render y conectados: el client pega al server por
variable de entorno, y el server pega a Neon (Postgres) por `DATABASE_URL`.
Las migraciones de Prisma corren solas en el build del deploy.

---

## Requisitos

- **Node 22 LTS** (hay un `.nvmrc` en la raíz: `nvm install && nvm use`).
- npm (viene con Node).

---

## Levantar en local

### Server

```bash
cd server
cp .env.example .env      # completar DATABASE_URL (ver "Variables de entorno")
npm install
npm run migrate:deploy    # aplica las migraciones de Prisma en tu base
npm run dev
```

```bash
curl http://localhost:3000/api/health      # -> {"status":"ok"}
curl http://localhost:3000/api/health/db   # -> {"status":"ok","db":"ok"}
```

### Client

```bash
cd client
cp .env.example .env      # VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

Abre http://localhost:5173.

Las pantallas que ya tienen datos (Calendario, Alquiler, Movimientos) trabajan
sobre el bien y el usuario de demo mientras no exista el login: corré
`npm run seed` en `server/` y copiá los ids que imprime a `VITE_DEMO_ASSET_ID`
y `VITE_DEMO_USER_ID`.

---

## Variables de entorno

| Servicio | Variable       | De dónde sale                                  |
| -------- | -------------- | ----------------------------------------------- |
| server   | `DATABASE_URL` | Connection string de Neon (usar un branch para desarrollo local). |
| server   | `PORT`         | Puerto local, default `3000`.                   |
| client   | `VITE_API_URL` | URL base del server (local o el de Render).     |
| client   | `VITE_DEMO_ASSET_ID` | Id del bien que se muestra. Lo imprime `npm run seed`. Temporal, hasta que haya login. |
| client   | `VITE_DEMO_USER_ID`  | Id del copropietario que usa la app. Lo imprime `npm run seed`. Temporal, hasta que haya login. |

---

## Deploy

- **Neon**: https://console.neon.tech — proyecto `comunero`. Esquema manejado
  por Prisma (`server/prisma/`).
- **Render**: https://dashboard.render.com — infra declarada en `render.yaml`
  (Blueprint), dos servicios: `comunero-client` (static) y `comunero-server`
  (web service). Auto-deploy en cada push a `main`.

---

## Estructura

```
Comunero/
├── render.yaml
├── client/
│   ├── .env.example
│   └── src/
│       ├── App.jsx
│       ├── lib/api.js         # cliente HTTP hacia el server
│       ├── pages/              # una vista por entidad
│       ├── components/         # UI reutilizable por entidad
│       └── services/           # llamadas a la API por entidad
└── server/
    ├── .env.example
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    └── src/
        ├── index.js
        ├── prisma.js
        ├── routes/              # una ruta por entidad
        ├── controllers/         # un controller por entidad
        └── services/            # un service por entidad
```
