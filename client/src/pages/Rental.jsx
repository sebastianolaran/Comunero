import { NavLink, Outlet, useNavigate } from 'react-router'
import { userIdActual } from '../lib/currentUser'
import './Rental.css'

const SUBSECCIONES = [
  { path: 'solicitudes', label: 'Solicitudes' },
  { path: 'historial-inquilinos', label: 'Historial de inquilinos' },
  { path: 'tareas-preparacion', label: 'Tareas de preparación' },
]

const claseTab = ({ isActive }) => (isActive ? 'seg__b seg__b--on' : 'seg__b')

function Rental() {
  const navigate = useNavigate()

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
          <button type="button" className="btn btn--primary" onClick={nuevaSolicitud}>
            + Nueva solicitud
          </button>
        )}
      </div>

      <Outlet />
    </section>
  )
}

export default Rental
