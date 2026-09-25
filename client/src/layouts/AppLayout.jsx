import { Outlet, useLocation, useNavigate } from 'react-router'
import Navbar from '../components/Navbar'
import { userNameActual } from '../lib/currentUser'
import { cerrarSesion } from '../lib/session'
import { SECCIONES } from '../sections'

// Las iniciales del avatar: "Ana" -> "An", "Ana María" -> "AM".
function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/)
  const letras =
    partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)
  return letras.charAt(0).toUpperCase() + letras.slice(1).toLowerCase()
}

function tituloDe(pathname) {
  const path = pathname.split('/')[1]
  const seccion = SECCIONES.find((s) => s.path === path)
  return seccion ? (seccion.titulo ?? seccion.label) : ''
}

function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const nombreUsuario = userNameActual()

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <header className="top">
          <div className="top__in">
            <h1 className="top__t">{tituloDe(pathname)}</h1>
            {nombreUsuario && (
              <div className="who">
                <span className="who__a" aria-hidden="true">
                  {iniciales(nombreUsuario)}
                </span>
                {nombreUsuario}
                <button
                  type="button"
                  className="btn btn--link who__out"
                  onClick={salir}
                >
                  Salir
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="view">
          <div className="page">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}

export default AppLayout
