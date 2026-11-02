import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { userIdActual } from '../lib/currentUser'
import './Rental.css'

const SUBSECCIONES = [
  { path: 'solicitudes', label: 'Solicitudes' },
  { path: 'historial-alquileres', label: 'Historial de alquileres' },
  { path: 'historial-inquilinos', label: 'Historial de inquilinos' },
  { path: 'tareas-preparacion', label: 'Tareas de preparación' },
]

const claseTab = ({ isActive }) => (isActive ? 'seg__b seg__b--on' : 'seg__b')

function Rental() {
  const navigate = useNavigate()
  // Con una solicitud abierta, su acción es la principal de la vista y el alta
  // pasa a secundaria: nunca dos botones de tinta a la vez.
  const [detalleAbierto, setDetalleAbierto] = useState(false)

  // Solicitudes abre el alta cuando llega este state (lo usa también el historial de inquilinos).
  const nuevaSolicitud = () => navigate('solicitudes', { state: { nuevaSolicitud: {} } })

  return (
    <section>
      <div className="alq-bar">
        <nav className="seg alq-tabs" aria-label="Alquiler a terceros">
          {SUBSECCIONES.map(({ path, label }) => (
            <NavLink key={path} to={path} className={claseTab}>
              {label}
            </NavLink>
          ))}
        </nav>
        {userIdActual() && (
          <button type="button" className={detalleAbierto ? 'btn' : 'btn btn--primary'} onClick={nuevaSolicitud}>
            Cargar solicitud
          </button>
        )}
      </div>

      <Outlet context={{ setDetalleAbierto }} />
    </section>
  )
}

export default Rental
