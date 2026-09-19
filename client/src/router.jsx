import { createBrowserRouter, Navigate } from 'react-router'
import AppLayout from './layouts/AppLayout'
import Calendario from './pages/Calendario'
import ProntoADesarrollar from './pages/ProntoADesarrollar'
import { SECCIONES } from './sections'

// Secciones que ya tienen su pagina implementada, en vez de placeholder.
const PAGINAS = {
  calendario: <Calendario />,
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
        element: PAGINAS[path] ?? <ProntoADesarrollar titulo={label} />,
      })),
      { path: '*', element: <Navigate to="/calendario" replace /> },
    ],
  },
])
