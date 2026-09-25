require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const rentalPreparationRoutes = require('./routes/rentalPreparation');
const healthDbRoutes = require('./routes/healthDb');
const rentalRequestRoutes = require('./routes/rentalRequest');
const reservationRoutes = require('./routes/reservation');
const movementRoutes = require('./routes/movement');
const balanceRoutes = require('./routes/balance');
const movementService = require('./services/movement.service');
const tenantRoutes = require('./routes/tenant');

const app = express();

// El client vive en otro origen (static site de Render), asi que habilitamos
// CORS. Sigue abierto aun con el login: la sesion no viaja en cookies, asi que
// un origen ajeno no puede usar credenciales del navegador contra esta API.
// Si alguna vez se pasa a cookie httpOnly, hay que restringir origin.
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rental-preparations', rentalPreparationRoutes);

// La ruta mas especifica primero.
app.use('/api/health/db', healthDbRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/rental-requests', rentalRequestRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/balances', balanceRoutes);
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

  // Los recurrentes tambien se generan al abrir Movimientos; esto los deja
  // listos el 1 de cada mes aunque nadie entre a la pantalla.
  const generateRecurrences = () =>
    movementService.generateAllDueRecurrences().catch((err) => {
      console.error('recurrentes: fallo la generacion', err);
    });
  generateRecurrences();
  setInterval(generateRecurrences, 60 * 60 * 1000).unref();
}

module.exports = app;
