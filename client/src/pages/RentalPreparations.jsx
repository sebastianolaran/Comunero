import { useEffect, useState } from 'react'
import RentalPreparationCard from '../components/RentalPreparationCard'
import Pagination from '../components/Pagination'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
import { assetIdActual } from '../lib/currentAsset'
import { actualizarTarea, agregarTarea, quitarTarea } from '../lib/rentalPreparations'
import { fetchRentalPreparations } from '../services/rentalPreparation'
import { usePaginacion } from '../lib/pagination'

// Alquileres aprobados con sus tareas y responsables. Se pueden agregar tareas,
// tildarlas, reasignarlas y eliminarlas.
function RentalPreparations({ assetId = assetIdActual() }) {
  const [carga, setCarga] = useState({ estado: 'loading', alquileres: [] })
  const [intento, setIntento] = useState(0)
  // Primero lo que viene, del más cercano al más lejano: es lo que hay que
  // preparar. Los terminados van aparte, del más reciente al más viejo.
  const proximos = carga.alquileres.filter((a) => !a.finished).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const terminados = carga.alquileres.filter((a) => a.finished).sort((a, b) => b.startDate.localeCompare(a.startDate))
  const paginacion = usePaginacion(proximos)
  const paginacionTerminados = usePaginacion(terminados)

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
    return <Vacio panel titulo="La sesión no está activa.">Ingresar de nuevo para continuar.</Vacio>
  }

  if (carga.estado === 'loading') {
    return (
      <Cargando filas={3}>Cargando tareas de preparación…</Cargando>
    )
  }

  if (carga.estado === 'error') {
    return (
      <ErrorCarga titulo="No se pudieron cargar las tareas de preparación." onReintentar={reintentar} />
    )
  }

  if (carga.alquileres.length === 0) {
    return <Vacio panel titulo="Todavía no hay alquileres aprobados." />
  }

  const lista = (alquileres) => (
    <ul className="alq-lista" role="list">
      {alquileres.map((alquiler) => (
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
  )

  return (
    <div className="prep-lista">
      {proximos.length > 0 ? (
        <>
          {lista(paginacion.elementos)}
          <Pagination {...paginacion} />
        </>
      ) : (
        <Vacio panel titulo="No hay alquileres por venir.">Cuando se apruebe uno, acá van a aparecer sus tareas.</Vacio>
      )}

      {terminados.length > 0 && (
        <details className="prep-terminados">
          <summary className="btn btn--link">
            {terminados.length === 1 ? 'Ver 1 alquiler terminado' : `Ver ${terminados.length} alquileres terminados`}
          </summary>
          {lista(paginacionTerminados.elementos)}
          <Pagination {...paginacionTerminados} />
        </details>
      )}
    </div>
  )
}

export default RentalPreparations
