// Secciones de la app, en el orden en que aparecen en el panel lateral.
// Cada una es una ruta propia (`/calendario`, `/movimientos`, ...).
// `titulo` es lo que muestra la barra superior cuando difiere del label.
export const SECCIONES = [
  { path: 'calendario', label: 'Reservas' },
  { path: 'alquiler', label: 'Alquileres', titulo: 'Alquileres a terceros' },
  { path: 'movimientos', label: 'Movimientos' },
  { path: 'balance', label: 'Balances' },
  { path: 'decisiones', label: 'Decisiones', titulo: 'Decisiones grupales' },
  { path: 'configuracion', label: 'Configuración' },
]
