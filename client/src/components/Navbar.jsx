import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { assetNameActual, inviteCodeActual } from '../lib/currentAsset'
import { useCopiado } from '../lib/useCopiado'
import { SECCIONES } from '../sections'
import BackendStatus from './BackendStatus'
import Icono from './Iconos'
import './Navbar.css'

const claseLink = ({ isActive }) => (isActive ? 'nav__b nav__b--on' : 'nav__b')

function CodigoDelBien({ codigo }) {
  const [visible, setVisible] = useState(false)
  const { copiado, copiar } = useCopiado()
  const etiquetaOjo = visible ? 'Ocultar código' : 'Mostrar código'

  return (
    <div className="codigo">
      <div className="codigo__fila">
        <span className="codigo__l">Código</span>
        <span className={`codigo__v${visible ? '' : ' codigo__v--oculto'}`} aria-label={visible ? codigo : 'Código oculto'}>
          {visible ? codigo : '••••••••'}
        </span>
        <button
          type="button"
          className="codigo__b"
          onClick={() => setVisible((v) => !v)}
          title={etiquetaOjo}
          aria-label={etiquetaOjo}
        >
          <Icono nombre={visible ? 'ojoTachado' : 'ojo'} />
        </button>
        <button
          type="button"
          className={`codigo__b${copiado ? ' codigo__b--ok' : ''}`}
          onClick={() => copiar(codigo)}
          title="Copiar código"
          aria-label="Copiar código"
        >
          <Icono nombre={copiado ? 'check' : 'copiar'} />
        </button>
      </div>
      <p className="codigo__ok" role="status">
        {copiado ? 'Copiado. Pegalo en el chat del grupo para que se sumen.' : ''}
      </p>
    </div>
  )
}

function Navbar() {
  const codigo = inviteCodeActual()

  return (
    <aside className="side">
      <Link to="/bienes" className="side__volver">
        <Icono nombre="atras" />
        Mis bienes
      </Link>

      <div className="brand">
        <p className="brand__n">Comunero</p>
        <p className="brand__s">{assetNameActual()}</p>
        {codigo && <CodigoDelBien codigo={codigo} />}
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
