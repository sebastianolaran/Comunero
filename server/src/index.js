require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const rentalPreparationRoutes = require('./routes/rentalPreparation');
const healthDbRoutes = require('./routes/healthDb');

const app = express();

// El client vive en otro origen (static site de Render), asi que habilitamos
// CORS. Abierto por ahora: es una API sin datos sensibles todavia.
app.use(cors());
app.use(express.json());

app.use('/api/rental-preparations', rentalPreparationRoutes);

// La ruta mas especifica primero.
app.use('/api/health/db', healthDbRoutes);
app.use('/api/health', healthRoutes);

const PORT = process.env.PORT || 3000;

// Solo levanta el servidor cuando se ejecuta directamente (no al importarlo en tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`server escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
