import { NavLink, useNavigate } from 'react-router'
import { assetNameActual } from '../lib/currentAsset'
import { userNameActual } from '../lib/currentUser'
import { cerrarSesion } from '../lib/session'
import { SECCIONES } from '../sections'
import BackendStatus from './BackendStatus'
import './Navbar.css'

// Las iniciales del avatar: "Ana" -> "A", "Ana María" -> "AM".
function iniciales(nombre) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

function Navbar() {
  const navigate = useNavigate()
  const nombreBien = assetNameActual()
  const nombreUsuario = userNameActual()

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="navbar">
      <header className="navbar-header">
        <p className="navbar-app">Compartido</p>
        <p className="navbar-bien">{nombreBien}</p>
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
        {nombreUsuario && (
          <div className="navbar-quien">
            <span className="navbar-avatar" aria-hidden="true">
              {iniciales(nombreUsuario)}
            </span>
            <span className="navbar-nombre">{nombreUsuario}</span>
            <button type="button" className="navbar-salir" onClick={salir}>
              Salir
            </button>
          </div>
        )}
        <BackendStatus />
      </footer>
    </aside>
  )
}

export default Navbar
