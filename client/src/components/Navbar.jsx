import { NavLink } from 'react-router'
import { assetNameActual } from '../lib/currentAsset'
import { SECCIONES } from '../sections'
import BackendStatus from './BackendStatus'
import './Navbar.css'

const claseLink = ({ isActive }) => (isActive ? 'nav__b nav__b--on' : 'nav__b')

function Navbar() {
  return (
    <aside className="side">
      <div className="brand">
        <p className="brand__n">Comunero</p>
        <p className="brand__s">{assetNameActual()}</p>
      </div>

      <nav className="nav" aria-label="Secciones">
        {SECCIONES.map(({ path, label }) => (
          <NavLink key={path} to={`/${path}`} className={claseLink}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="side__foot">
        <BackendStatus />
      </div>
    </aside>
  )
}

export default Navbar
