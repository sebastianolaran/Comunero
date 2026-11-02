// Ficha pública, del lado de quien recibe el link: sin cuenta ni sesión.
// Modulos enteros (no destructuring) para poder mockearlos en los tests.
const listingService = require('../services/listing.service');
const rentalRequestService = require('../services/rentalRequest.service');
const { parsePublicRequest, amountFor } = require('../validation/publicRentalRequest');
const { previewHtml, notFoundHtml } = require('../lib/listingPreview');

// Adónde manda la vista previa a las personas. En Render se configura en render.yaml.
const APP_URL = (process.env.PUBLIC_APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
// Mismo formato que newSlug (base64url); cualquier otra cosa no es un link de ficha.
const SLUG = /^[\w-]{1,64}$/;
const PREVIEW_CACHE = 'public, max-age=300';

// Corto: al pausar la ficha o cambiar el link, las fotos dejan de verse enseguida.
const PHOTO_CACHE = 'public, max-age=600';

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
    const result = await rentalRequestService.create({
      ...request,
      assetId: target.assetId,
      userId: null,
      amount: amountFor(request.startDate, request.endDate, target.rentalDailyRate),
    });
    if (result.error === 'OCCUPIED') {
      return res.status(409).json({ error: 'Esas fechas ya están ocupadas: elegir otras en el calendario', field: 'startDate' });
    }
    // No se devuelve la solicitud: tiene votos y datos de los copropietarios.
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('public-listing: fallo el alta de la solicitud', err);
    res.status(500).json({ error: 'No se pudo enviar la solicitud. Volver a intentar en un momento.' });
  }
}

async function availability(req, res) {
  try {
    const occupied = await listingService.getAvailability(req.params.slug);
    if (!occupied) return res.status(404).json({ error: 'Este link no corresponde a ninguna ficha' });
    res.set('Cache-Control', 'no-store');
    res.json({ occupied });
  } catch (err) {
    console.error('public-listing: fallo la disponibilidad', err);
    res.status(500).json({ error: 'No se pudo cargar la disponibilidad' });
  }
}

// GET /f/:slug: el link que se comparte. Las apps de mensajería leen las
// etiquetas Open Graph; las personas siguen de largo a la ficha.
async function preview(req, res) {
  const { slug } = req.params;
  res.type('html');
  if (!SLUG.test(slug)) return res.status(404).send(notFoundHtml({ appUrl: APP_URL }));
  try {
    const listing = await listingService.getPublic(slug);
    if (!listing) return res.status(404).send(notFoundHtml({ appUrl: APP_URL, slug }));
    const apiUrl = `${req.protocol}://${req.get('host')}`;
    res.set('Cache-Control', PREVIEW_CACHE);
    res.send(previewHtml(listing, { slug, appUrl: APP_URL, apiUrl }));
  } catch (err) {
    console.error('public-listing: fallo la vista previa', err);
    // Aunque falle la base, la persona llega a la ficha (que reintenta sola).
    res.status(500).send(notFoundHtml({ appUrl: APP_URL, slug }));
  }
}

module.exports = { get, photo, availability, submitRequest, preview };
