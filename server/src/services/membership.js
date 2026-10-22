// Filtro de Prisma: usuarios que son copropietarios del bien.
function memberOf(assetId) {
  return { assets: { some: { id: assetId } } };
}

module.exports = { memberOf };
