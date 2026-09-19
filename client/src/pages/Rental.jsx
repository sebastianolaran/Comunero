import { NavLink, Outlet } from 'react-router'
import './Rental.css'

const SUBSECCIONES = [
  { path: 'solicitudes', label: 'Solicitudes' },
  { path: 'historial-inquilinos', label: 'Historial de inquilinos' },
  { path: 'tareas-preparacion', label: 'Tareas de preparación' },
]

function Rental() {
  return (
    <section className="alquiler">
      <h1 className="alquiler-titulo">Alquiler a terceros</h1>

      <nav aria-label="Alquiler a terceros">
        <ul className="alquiler-tabs">
          {SUBSECCIONES.map(({ path, label }) => (
            <li key={path}>
              <NavLink to={path} className="alquiler-tab">
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </section>
  )
}

export default Rental
