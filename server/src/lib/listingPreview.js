// Página mínima para que WhatsApp (y cualquier app que arme la tarjeta del
// link) muestre el nombre, los datos y una foto del lugar. La app es una SPA:
// sin esto el crawler solo ve el index.html genérico. A las personas las manda
// directo a la ficha.

const MAX_DESCRIPTION = 160;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const money = (amount) => `$${amount.toLocaleString('es-AR')}`;

function summary(listing) {
  const parts = [
    listing.approxLocation,
    listing.capacity != null && `Hasta ${listing.capacity} ${listing.capacity === 1 ? 'persona' : 'personas'}`,
    listing.rentalDailyRate != null && `${money(listing.rentalDailyRate)} por día`,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  const text = (listing.description ?? '').replace(/\s+/g, ' ').trim();
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1)}…` : text;
}

function page({ title, description, image, url }) {
  const meta = [
    ['og:type', 'website'],
    ['og:site_name', 'Comunero'],
    ['og:title', title],
    description && ['og:description', description],
    image && ['og:image', image],
    ['og:url', url],
  ].filter(Boolean);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escape(title)}</title>
${meta.map(([property, content]) => `<meta property="${property}" content="${escape(content)}">`).join('\n')}
${image ? '<meta name="twitter:card" content="summary_large_image">' : ''}
<meta http-equiv="refresh" content="0;url=${escape(url)}">
</head>
<body><p><a href="${escape(url)}">Ver la ficha</a></p></body>
</html>`;
}

// listing: la vista pública (listing.service getPublic).
function previewHtml(listing, { slug, appUrl, apiUrl }) {
  const url = `${appUrl}/ficha/${encodeURIComponent(slug)}`;
  const first = listing.photos[0];
  const image = first
    ? `${apiUrl}/api/public/listings/${encodeURIComponent(slug)}/photos/${encodeURIComponent(first.id)}`
    : null;
  return page({ title: listing.name, description: summary(listing), image, url });
}

function notFoundHtml({ appUrl, slug }) {
  const url = slug ? `${appUrl}/ficha/${encodeURIComponent(slug)}` : appUrl;
  return page({ title: 'Comunero', description: null, image: null, url });
}

module.exports = { previewHtml, notFoundHtml };
