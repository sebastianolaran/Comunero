import { Outlet } from 'react-router'
import Navbar from '../components/Navbar'
import './AppLayout.css'

// Panel lateral fijo + contenido de la sección activa a la derecha.
function AppLayout() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
