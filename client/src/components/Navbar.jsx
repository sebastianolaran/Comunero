import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
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
        {copiado ? 'Código copiado, listo para compartir con el grupo.' : ''}
      </p>
    </div>
  )
}

function Navbar() {
  const codigo = inviteCodeActual()

  // En mobile la navegación es una franja con scroll: la sección activa
  // tiene que quedar a la vista aunque esté al final.
  const nav = useRef(null)
  const { pathname } = useLocation()
  useEffect(() => {
    nav.current?.querySelector('.nav__b--on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])

  return (
    <aside className="side">
      <Link to="/bienes" className="side__volver">
        <Icono nombre="atras" />
        Bienes
      </Link>

      <div className="brand">
        <p className="brand__n">Comunero</p>
        <p className="brand__s">{assetNameActual()}</p>
        {codigo && <CodigoDelBien codigo={codigo} />}
      </div>

      <nav ref={nav} className="nav" aria-label="Secciones">
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
