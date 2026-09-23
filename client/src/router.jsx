import { createBrowserRouter, Navigate } from 'react-router'
import { RequiereSesion, SoloSinSesion } from './components/SesionGuard'
import AppLayout from './layouts/AppLayout'
import Calendario from './pages/Calendario'
import Login from './pages/Login'
import ProntoADesarrollar from './pages/ProntoADesarrollar'
import Rental from './pages/Rental'
import RentalPreparations from './pages/RentalPreparations'
import RentalRequests from './pages/RentalRequests'
import { SECCIONES } from './sections'

const PANTALLAS = {
  calendario: { element: <Calendario /> },
  alquiler: {
    element: <Rental />,
    children: [
      { index: true, element: <Navigate to="solicitudes" replace /> },
      { path: 'solicitudes', element: <RentalRequests /> },
      {
        path: 'historial-inquilinos',
        element: <ProntoADesarrollar titulo="Historial de inquilinos" />,
      },
      { path: 'tareas-preparacion', element: <RentalPreparations /> },
    ],
  },
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <SoloSinSesion>
        <Login />
      </SoloSinSesion>
    ),
  },
  {
    path: '/',
    element: (
      <RequiereSesion>
        <AppLayout />
      </RequiereSesion>
    ),
    children: [
      // Al entrar sin elegir nada, arranca en Calendario.
      { index: true, element: <Navigate to="calendario" replace /> },
      ...SECCIONES.map(({ path, label }) => ({
        path,
        ...(PANTALLAS[path] ?? { element: <ProntoADesarrollar titulo={label} /> }),
      })),
      { path: '*', element: <Navigate to="/calendario" replace /> },
    ],
  },
])
