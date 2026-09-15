# Comunero

Monorepo del TP. Dos proyectos independientes:

| Carpeta   | Qué es                            | Levanta en            |
| --------- | ---------------------------------- | ---------------------- |
| `client/` | React + Vite (JS)                  | http://localhost:5173  |
| `server/` | API Express + ruta `/api/health`   | http://localhost:3000  |

Todavía no están conectados entre sí. La base de datos (Neon) y el deploy (Render)
están creados pero vacíos; se conectan en las próximas HU.

---

## Requisitos

- **Node 22 LTS** (hay un `.nvmrc` en la raíz: `nvm install && nvm use`).
- npm (viene con Node).

---

## Levantar en local

### Client

```bash
cd client
npm install
npm run dev
```

Abre http://localhost:5173.

### Server

```bash
cd server
cp .env.example .env      # completar DATABASE_URL y PORT
npm install
npm run dev
```

```bash
curl http://localhost:3000/api/health
# -> {"status":"ok"}
```

---

## Estructura

```
Comunero/
├── client/            # React + Vite
└── server/
    ├── .env.example
    └── src/
        ├── index.js       # crea la app, monta /api/health, listen(PORT)
        └── routes/
            └── health.js  # GET / -> { status: "ok" }
```
