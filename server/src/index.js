require('dotenv').config({ quiet: true });

const express = require('express');
const healthRoutes = require('./routes/health');

const app = express();

app.use(express.json());

app.use('/api/health', healthRoutes);

const PORT = process.env.PORT || 3000;

// Solo levanta el servidor cuando se ejecuta directamente (no al importarlo en tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`server escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
