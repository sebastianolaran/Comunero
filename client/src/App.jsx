import { useState } from 'react'
import Rental from './pages/Rental'
import './App.css'

const SECCIONES = [
  { id: 'calendario', label: 'Calendario', titulo: 'Calendario' },
  { id: 'alquiler', label: 'Alquiler', titulo: 'Alquiler a terceros' },
  { id: 'gastos', label: 'Movimientos', titulo: 'Movimientos' },
  { id: 'balance', label: 'Balance', titulo: 'Balance' },
  { id: 'decisiones', label: 'Decisiones', titulo: 'Decisiones grupales' },
  { id: 'historial', label: 'Historial', titulo: 'Historial' },
  { id: 'config', label: 'Configuración', titulo: 'Configuración' },
]

// Layout del prototipo (Compartido.dc.html): barra lateral con las
// secciones y header. Por ahora solo Alquiler tiene contenido. Mientras no
// hay login, el bien sale del entorno.
function App({ assetId = import.meta.env.VITE_DEMO_ASSET_ID }) {
  const [vista, setVista] = useState('alquiler')
  const seccion = SECCIONES.find((s) => s.id === vista)

  let contenido
  if (vista !== 'alquiler') {
    contenido = <p className="notice">Esta sección todavía no está disponible.</p>
  } else if (!assetId) {
    contenido = (
      <p className="notice">
        Falta configurar <code>VITE_DEMO_ASSET_ID</code> en <code>client/.env</code>.
      </p>
    )
  } else {
    contenido = <Rental assetId={assetId} />
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <p className="sidebar__title">Comunero</p>
        <nav className="nav" aria-label="Secciones">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="nav__item"
              aria-current={s.id === vista ? 'page' : undefined}
              onClick={() => setVista(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="topbar__title">{seccion.titulo}</h1>
        </header>

        <div className="content">{contenido}</div>
      </main>
    </div>
  )
}

export default App
