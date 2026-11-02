// En el plan gratis de Render el server se duerme a los 15 minutos sin tráfico
// y la primera visita a una ficha tarda medio minuto. Pegarle a la URL pública
// (pasa por el proxy de Render, así que cuenta como tráfico) lo mantiene
// despierto. Render define RENDER_EXTERNAL_URL; en local no corre.

const DIEZ_MINUTOS_MS = 10 * 60 * 1000;

function startKeepAlive({
  url = process.env.RENDER_EXTERNAL_URL,
  intervalMs = DIEZ_MINUTOS_MS,
  fetchImpl = fetch,
  setIntervalImpl = setInterval,
  logError = console.error,
} = {}) {
  if (!url) return null;
  const healthUrl = `${url.replace(/\/+$/, '')}/api/health`;
  const ping = async () => {
    try {
      await fetchImpl(healthUrl);
    } catch (err) {
      logError('keep-alive: no respondió /api/health', err.message);
    }
  };
  const timer = setIntervalImpl(ping, intervalMs);
  timer.unref?.();
  return timer;
}

module.exports = { startKeepAlive };
