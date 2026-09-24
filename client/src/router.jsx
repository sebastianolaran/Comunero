import { createBrowserRouter, Navigate } from 'react-router'
import AppLayout from './layouts/AppLayout'
import Balance from './pages/Balance'
import Calendario from './pages/Calendario'
import Movimientos from './pages/Movimientos'
import ProntoADesarrollar from './pages/ProntoADesarrollar'
import Rental from './pages/Rental'
import RentalPreparations from './pages/RentalPreparations'
import RentalRequests from './pages/RentalRequests'
import { SECCIONES } from './sections'

const PANTALLAS = {
  calendario: { element: <Calendario /> },
  movimientos: { element: <Movimientos /> },
  balance: { element: <Balance /> },
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
