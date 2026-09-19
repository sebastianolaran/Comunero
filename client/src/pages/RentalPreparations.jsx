import { useEffect, useState } from 'react'
import RentalPreparationCard from '../components/RentalPreparationCard'
import { agregarTarea } from '../lib/rentalPreparations'
import { fetchRentalPreparations } from '../services/rentalPreparation'
import './RentalPreparations.css'

// TODO: usar el bien del usuario logueado cuando exista el login.
const ASSET_ID = import.meta.env.VITE_DEMO_ASSET_ID

// Alquileres aprobados con sus tareas y responsables. Se pueden agregar tareas;
// tildar y reasignar son otras historias.
function RentalPreparations({ assetId = ASSET_ID }) {
  const [carga, setCarga] = useState({ estado: 'loading', alquileres: [] })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!assetId) return
    const controller = new AbortController()
    let vivo = true

    fetchRentalPreparations(assetId, { signal: controller.signal })
      .then((alquileres) => {
        if (vivo) setCarga({ estado: 'ok', alquileres })
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setCarga({ estado: 'error', alquileres: [] })
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [assetId, intento])

  // Se agrega en el estado en vez de volver a pedir la lista: recargar
  // desmontaría las tarjetas y se perdería lo escrito en los otros formularios.
  const agregarTareaAlAlquiler = (alquilerId, tarea) => {
    setCarga((previa) => ({
      ...previa,
      alquileres: previa.alquileres.map((alquiler) =>
        alquiler.id === alquilerId ? agregarTarea(alquiler, tarea) : alquiler,
      ),
    }))
  }

  const reintentar = () => {
    setCarga({ estado: 'loading', alquileres: [] })
    setIntento((n) => n + 1)
  }

  if (!assetId) {
    return (
      <p className="aviso">
        Falta configurar <code>VITE_DEMO_ASSET_ID</code> en <code>client/.env</code>.
      </p>
    )
  }

  if (carga.estado === 'loading') {
    return (
      <p className="aviso" role="status">
        Cargando tareas de preparación…
      </p>
    )
  }

  if (carga.estado === 'error') {
    return (
      <div className="aviso" role="alert">
        <p>No se pudieron cargar las tareas de preparación.</p>
        <p className="aviso-hint">
          Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.
        </p>
        <button type="button" className="aviso-reintentar" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    )
  }

  if (carga.alquileres.length === 0) {
    return <p className="aviso">Todavía no hay alquileres aprobados.</p>
  }

  return (
    <div className="preparaciones">
      <ul className="preparaciones-lista" role="list">
        {carga.alquileres.map((alquiler) => (
          <li key={alquiler.id}>
            <RentalPreparationCard alquiler={alquiler} onTareaCreada={agregarTareaAlAlquiler} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RentalPreparations
