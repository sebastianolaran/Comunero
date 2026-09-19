import { createBrowserRouter, Navigate } from 'react-router'
import AppLayout from './layouts/AppLayout'
import ProntoADesarrollar from './pages/ProntoADesarrollar'
import RentalPreparations from './pages/RentalPreparations'
import Rental from './pages/Rental'
import { SECCIONES } from './sections'

const PANTALLAS = {
  alquiler: {
    element: <Rental />,
    children: [
      { index: true, element: <Navigate to="solicitudes" replace /> },
      { path: 'solicitudes', element: <ProntoADesarrollar titulo="Solicitudes" /> },
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
    path: '/',
    element: <AppLayout />,
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
