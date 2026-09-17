import { NavLink } from 'react-router'
import { SECCIONES } from '../sections'
import BackendStatus from './BackendStatus'
import './Navbar.css'

// TODO: sacar el nombre del bien de GET /api/me (o del asset asociado) cuando
// exista el endpoint. Por ahora es un placeholder.
const NOMBRE_BIEN = 'Casa quinta'

function Navbar() {
  return (
    <aside className="navbar">
      <header className="navbar-header">
        <p className="navbar-app">Compartido</p>
        <p className="navbar-bien">{NOMBRE_BIEN}</p>
      </header>

      <nav aria-label="Secciones">
        <ul className="navbar-links">
          {SECCIONES.map(({ path, label }) => (
            <li key={path}>
              <NavLink to={`/${path}`} className="navbar-link">
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <footer className="navbar-footer">
        <BackendStatus />
      </footer>
    </aside>
  )
}

export default Navbar
