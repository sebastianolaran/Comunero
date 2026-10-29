import { createBrowserRouter, Navigate } from 'react-router'
import { RequiereBien, RequiereSesion, SoloSinSesion } from './components/SesionGuard'
import AppLayout from './layouts/AppLayout'
import Balance from './pages/Balance'
import Calendario from './pages/Calendario'
import Configuracion from './pages/Configuracion'
import Movimientos from './pages/Movimientos'
import Login from './pages/Login'
import MisBienes from './pages/MisBienes'
import Decisiones from './pages/Decisiones'
import Registro from './pages/Registro'
import Rental from './pages/Rental'
import RentalHistory from './pages/RentalHistory'
import RentalPreparations from './pages/RentalPreparations'
import RentalRequests from './pages/RentalRequests'
import TenantHistory from './pages/TenantHistory'
import { SECCIONES } from './sections'

const PANTALLAS = {
  calendario: { element: <Calendario /> },
  movimientos: { element: <Movimientos /> },
  balance: { element: <Balance /> },
  decisiones: { element: <Decisiones /> },
  configuracion: { element: <Configuracion /> },
  alquiler: {
    element: <Rental />,
    children: [
      { index: true, element: <Navigate to="solicitudes" replace /> },
      { path: 'solicitudes', element: <RentalRequests /> },
      { path: 'historial-alquileres', element: <RentalHistory /> },
      { path: 'historial-inquilinos', element: <TenantHistory /> },
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
    path: '/registro',
    element: (
      <SoloSinSesion>
        <Registro />
      </SoloSinSesion>
    ),
  },
  {
    // Tus bienes compartidos: elegir, crear o sumarse a un bien.
    path: '/bienes',
    element: (
      <RequiereSesion>
        <MisBienes />
      </RequiereSesion>
    ),
  },
  {
    path: '/',
    element: (
      <RequiereBien>
        <AppLayout />
      </RequiereBien>
    ),
    children: [
      // Al entrar sin elegir nada, arranca en Calendario.
      { index: true, element: <Navigate to="calendario" replace /> },
      ...SECCIONES.map(({ path }) => ({
        path,
        ...PANTALLAS[path],
      })),
      { path: '*', element: <Navigate to="/calendario" replace /> },
    ],
  },
])
