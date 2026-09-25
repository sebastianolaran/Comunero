// Secciones de la app, en el orden en que aparecen en el panel lateral.
// Cada una es una ruta propia (`/calendario`, `/movimientos`, ...).
// `titulo` es lo que muestra la barra superior cuando difiere del label.
export const SECCIONES = [
  { path: 'calendario', label: 'Calendario' },
  { path: 'alquiler', label: 'Alquiler', titulo: 'Alquiler a terceros' },
  { path: 'movimientos', label: 'Movimientos' },
  { path: 'balance', label: 'Balance' },
  { path: 'decisiones', label: 'Decisiones' },
  { path: 'historial', label: 'Historial' },
  { path: 'configuracion', label: 'Configuración' },
]
