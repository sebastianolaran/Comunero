require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const rentalPreparationRoutes = require('./routes/rentalPreparation');
const healthDbRoutes = require('./routes/healthDb');
const rentalRequestRoutes = require('./routes/rentalRequest');
const reservationRoutes = require('./routes/reservation');
const tenantRoutes = require('./routes/tenant');

const app = express();

// El client vive en otro origen (static site de Render), asi que habilitamos
// CORS. Abierto por ahora: es una API sin datos sensibles todavia.
app.use(cors());
app.use(express.json());

app.use('/api/rental-preparations', rentalPreparationRoutes);

// La ruta mas especifica primero.
app.use('/api/health/db', healthDbRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/rental-requests', rentalRequestRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/tenants', tenantRoutes);

// Un JSON roto en el body lo rechaza express.json antes de llegar a un controller;
// sin esto la respuesta seria una pagina HTML en vez de { error }.
// Express lo reconoce como manejador de errores por tener 4 parametros.
app.use((err, _req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la peticion no es un JSON valido' });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;

// Solo levanta el servidor cuando se ejecuta directamente (no al importarlo en tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`server escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
