import { createBrowserRouter, Navigate } from 'react-router'
import AppLayout from './layouts/AppLayout'
import ProntoADesarrollar from './pages/ProntoADesarrollar'
import { SECCIONES } from './sections'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // Al entrar sin elegir nada, arranca en Calendario.
      { index: true, element: <Navigate to="calendario" replace /> },
      ...SECCIONES.map(({ path, label }) => ({
        path,
        element: <ProntoADesarrollar titulo={label} />,
      })),
      { path: '*', element: <Navigate to="/calendario" replace /> },
    ],
  },
])
