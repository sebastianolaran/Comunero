// Exportar el calendario a .ics. Los valores son los `scope` que acepta
// GET /api/calendar/export.ics.
export const OPCIONES_EXPORTAR = [
  { value: 'mine', label: 'Solo las mías' },
  { value: 'use', label: 'Todas las reservas' },
  { value: 'all', label: 'Reservas y alquileres' },
]

// El server manda el nombre en Content-Disposition (comunero-<bien>.ics).
export function nombreDeDescarga(contentDisposition) {
  const nombre = contentDisposition?.match(/filename="([^"]+)"/)?.[1]
  return nombre ?? 'comunero.ics'
}
