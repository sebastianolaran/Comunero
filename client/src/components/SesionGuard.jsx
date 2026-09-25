import { Navigate } from 'react-router'
import { leerSesion } from '../lib/session'

// Sin sesión no se entra a ninguna sección: el resto de las pantallas dan por
// sentado que hay un usuario y un bien, y sin eso quedarían pidiendo datos de
// nadie.
export function RequiereSesion({ children }) {
  return leerSesion() ? children : <Navigate to="/login" replace />
}

// Al revés: quien ya entró no necesita ver el formulario de nuevo.
export function SoloSinSesion({ children }) {
  return leerSesion() ? <Navigate to="/" replace /> : children
}
