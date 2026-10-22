import { useEffect, useState } from 'react'
import RentalPreparationCard from '../components/RentalPreparationCard'
import Pagination from '../components/Pagination'
import { assetIdActual } from '../lib/currentAsset'
import { actualizarTarea, agregarTarea, quitarTarea } from '../lib/rentalPreparations'
import { fetchRentalPreparations } from '../services/rentalPreparation'
import { usePaginacion } from '../lib/pagination'

// Alquileres aprobados con sus tareas y responsables. Se pueden agregar tareas,
// tildarlas, reasignarlas y eliminarlas.
function RentalPreparations({ assetId = assetIdActual() }) {
  const [carga, setCarga] = useState({ estado: 'loading', alquileres: [] })
  const [intento, setIntento] = useState(0)
  const alquileresOrdenados = [...carga.alquileres].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const paginacion = usePaginacion(alquileresOrdenados)

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

  // Los cambios se aplican en el estado en vez de volver a pedir la lista:
  // recargar desmontaría las tarjetas y se perdería lo escrito en los otros
  // formularios. `cambio` recibe el alquiler y devuelve el alquiler cambiado.
  const cambiarAlquiler = (alquilerId, cambio) => {
    setCarga((previa) => ({
      ...previa,
      alquileres: previa.alquileres.map((alquiler) => (alquiler.id === alquilerId ? cambio(alquiler) : alquiler)),
    }))
  }

  const agregarTareaAlAlquiler = (alquilerId, tarea) =>
    cambiarAlquiler(alquilerId, (alquiler) => agregarTarea(alquiler, tarea))

  const actualizarTareaDelAlquiler = (alquilerId, tarea) =>
    cambiarAlquiler(alquilerId, (alquiler) => actualizarTarea(alquiler, tarea))

  const quitarTareaDelAlquiler = (alquilerId, tareaId) =>
    cambiarAlquiler(alquilerId, (alquiler) => quitarTarea(alquiler, tareaId))

  const reintentar = () => {
    setCarga({ estado: 'loading', alquileres: [] })
    setIntento((n) => n + 1)
  }

  if (!assetId) {
    return <p className="panel empty">No encontramos tu sesión. Volvé a entrar.</p>
  }

  if (carga.estado === 'loading') {
    return (
      <p className="panel empty" role="status">
        Cargando tareas de preparación…
      </p>
    )
  }

  if (carga.estado === 'error') {
    return (
      <div className="panel empty empty--rail" role="alert">
        <p>No se pudieron cargar las tareas de preparación.</p>
        <p className="hint">Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.</p>
        <button type="button" className="btn btn--sm" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    )
  }

  if (carga.alquileres.length === 0) {
    return <p className="empty">Todavía no hay alquileres aprobados.</p>
  }

  return (
    <div className="prep-lista">
      <ul className="alq-lista" role="list">
        {paginacion.elementos.map((alquiler) => (
          <li key={alquiler.id}>
            <RentalPreparationCard
              alquiler={alquiler}
              onTareaCreada={agregarTareaAlAlquiler}
              onTareaActualizada={actualizarTareaDelAlquiler}
              onTareaEliminada={quitarTareaDelAlquiler}
            />
          </li>
        ))}
      </ul>
      <Pagination {...paginacion} />
    </div>
  )
}

export default RentalPreparations
