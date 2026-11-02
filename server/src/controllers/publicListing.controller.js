// Ficha pública, del lado de quien recibe el link: sin cuenta ni sesión.
// Modulos enteros (no destructuring) para poder mockearlos en los tests.
const listingService = require('../services/listing.service');
const rentalRequestService = require('../services/rentalRequest.service');
const { parsePublicRequest, amountFor } = require('../validation/publicRentalRequest');

// Las fotos no cambian: si se reemplaza una, cambia el id.
const PHOTO_CACHE = 'public, max-age=86400, immutable';

async function get(req, res) {
  try {
    const listing = await listingService.getPublic(req.params.slug);
    if (!listing) return res.status(404).json({ error: 'Este link no corresponde a ninguna ficha' });
    res.json({ listing });
  } catch (err) {
    console.error('public-listing: fallo la consulta de la ficha', err);
    res.status(500).json({ error: 'No se pudo cargar la ficha. Volver a intentar en un momento.' });
  }
}

async function photo(req, res) {
  try {
    const found = await listingService.getPublicPhoto(req.params.slug, req.params.photoId);
    if (!found) return res.status(404).json({ error: 'No existe la foto' });
    res.set({
      'Content-Type': found.mimeType,
      'Cache-Control': PHOTO_CACHE,
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(found.data));
  } catch (err) {
    console.error('public-listing: fallo la foto', err);
    res.status(500).json({ error: 'No se pudo cargar la foto' });
  }
}

// El bien sale del link; assetId, userId o amount que vengan en el body se ignoran.
async function submitRequest(req, res) {
  const body = req.body ?? {};
  try {
    const target = await listingService.assetForSlug(req.params.slug);
    if (!target) return res.status(404).json({ error: 'Este link no corresponde a ninguna ficha' });

    // Campo oculto que solo completan los bots: se les responde como si nada.
    if (typeof body.website === 'string' && body.website !== '') return res.status(201).json({ ok: true });

    const parsed = parsePublicRequest(body, { capacity: target.capacity });
    if (parsed.error) return res.status(400).json({ error: parsed.error, field: parsed.field });

    const { request } = parsed;
    await rentalRequestService.create({
      ...request,
      assetId: target.assetId,
      userId: null,
      amount: amountFor(request.startDate, request.endDate, target.rentalDailyRate),
    });
    // No se devuelve la solicitud: tiene votos y datos de los copropietarios.
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('public-listing: fallo el alta de la solicitud', err);
    res.status(500).json({ error: 'No se pudo enviar la solicitud. Volver a intentar en un momento.' });
  }
}

module.exports = { get, photo, submitRequest };
