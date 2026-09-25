import { useId, useRef, useState } from 'react'
import { formatRange, resumenEstado, resumenLabel, validarTarea } from '../lib/rentalPreparations'
import { createRentalTask, deleteRentalTask, updateRentalTask } from '../services/rentalPreparation'
import RentalPreparationTask from './RentalPreparationTask'
import './RentalPreparationCard.css'

// Como en el diseño: punteado mientras falta algo, borde lleno cuando está listo.
const CLASE_RESUMEN = { 'sin-tareas': 'badge badge--dash', pendientes: 'badge badge--dash', listo: 'badge badge--line' }

// Tarjeta de un alquiler aprobado: inquilino, fechas, resumen, tareas (que se
// pueden tildar, reasignar y eliminar) y, si el alquiler no terminó, el
// formulario para agregar una tarea.
// `alquiler` es un elemento de GET /api/rental-preparations. Cada callback
// avisa cuando el server confirma el cambio: `onTareaCreada(alquilerId, tarea)`,
// `onTareaActualizada(alquilerId, tarea)` y `onTareaEliminada(alquilerId, tareaId)`.
function RentalPreparationCard({ alquiler, onTareaCreada, onTareaActualizada, onTareaEliminada }) {
  const { id, renterName, startDate, endDate, tasks, summary, finished, coowners } = alquiler
  // El client es un static site que se despliega aparte: si llega antes que el
  // server, `coowners` todavía no viene y el formulario no tendría a quién asignar.
  // `finished` lo calcula el server con la fecha de Argentina y el POST lo vuelve a chequear.
  const puedeAgregar = Array.isArray(coowners) && !finished

  const [nombre, setNombre] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [errores, setErrores] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const nombreRef = useRef(null)
  const tarjetaRef = useRef(null)
  const tituloId = useId()
  const campoNombre = useId()
  const campoResponsable = useId()
  const listaErrores = useId()

  // Tildar, reasignar y eliminar: ids de las tareas que se están guardando (la
  // fila se atenúa y se ignoran sus cambios hasta que termine) y el error del
  // último cambio que falló.
  const [guardando, setGuardando] = useState([])
  const [erroresCambio, setErroresCambio] = useState([])
  const [avisoCambio, setAvisoCambio] = useState('')

  // El cambio se muestra recién cuando el server lo confirma: si falla (ej. "El
  // alquiler ya terminó") la tarea queda como estaba, sin nada que deshacer.
  const cambiar = async (tarea, pedir, alConfirmar, aviso = '') => {
    if (guardando.includes(tarea.id)) return

    setErroresCambio([])
    setAvisoCambio('')
    setGuardando((ids) => [...ids, tarea.id])
    try {
      const resultado = await pedir()
      alConfirmar(resultado)
      setAvisoCambio(aviso)
    } catch (err) {
      setErroresCambio(err.mensajes ?? ['No se pudo modificar la tarea. Probá de nuevo.'])
      // 404: otro copropietario ya la eliminó. Sin esto quedaría en la lista y
      // cada acción daría el mismo error hasta recargar la página.
      if (err.status === 404) onTareaEliminada(id, tarea.id)
    } finally {
      setGuardando((ids) => ids.filter((otro) => otro !== tarea.id))
    }
  }

  const modificar = (tarea, cambios) =>
    cambiar(tarea, () => updateRentalTask(tarea.id, cambios), (nueva) => onTareaActualizada(id, nueva))

  const tildar = (tarea, completed) => modificar(tarea, { completed })
  const reasignar = (tarea, assignedToId) => modificar(tarea, { assignedToId })

  const eliminar = (tarea) =>
    cambiar(
      tarea,
      () => deleteRentalTask(tarea.id),
      () => {
        onTareaEliminada(id, tarea.id)
        // El botón que tenía el foco desaparece con la tarea: el foco pasa a la
        // tarjeta (y no al campo de nueva tarea, que abriría el teclado en el celular).
        tarjetaRef.current?.focus()
      },
      'Tarea eliminada',
    )

  // Los mensajes del server y del client nombran el campo ("...el nombre...",
  // "...un responsable"), así se marca inválido solo el que corresponde. Un error
  // de otra cosa ("El alquiler ya terminó") no marca ninguno.
  const conError = (campo) => errores.some((mensaje) => mensaje.toLowerCase().includes(campo))

  // Al corregir un campo se descartan los errores viejos.
  const editar = (setter) => (evento) => {
    setter(evento.target.value)
    setConfirmacion('')
    setErrores([])
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (enviando) return

    const invalidos = validarTarea({ nombre, responsableId })
    if (invalidos.length > 0) {
      setErrores(invalidos)
      return
    }

    const enviado = { nombre, responsableId }
    setErrores([])
    setConfirmacion('')
    setEnviando(true)
    try {
      // El nombre va tal cual: el server lo recorta.
      const tarea = await createRentalTask({ reservationId: id, name: nombre, assignedToId: responsableId })
      // Solo se vacía lo que sigue igual a lo enviado: si el usuario ya empezó la
      // tarea siguiente mientras esperaba, no se pisa.
      setNombre((actual) => (actual === enviado.nombre ? '' : actual))
      setResponsableId((actual) => (actual === enviado.responsableId ? '' : actual))
      setConfirmacion('Tarea agregada')
      onTareaCreada(id, tarea)
      nombreRef.current?.focus()
    } catch (err) {
      // Sin tocar nombre ni responsable: lo escrito se conserva.
      setErrores(err.mensajes ?? ['No se pudo agregar la tarea. Probá de nuevo.'])
      nombreRef.current?.focus()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <article className="card card--flush prep" ref={tarjetaRef} tabIndex={-1} aria-labelledby={tituloId}>
      <div className="prep__head">
        <div className="prep__quien">
          <h2 id={tituloId} className="prep__name">{renterName ?? 'Sin interesado'}</h2>
          <p className="meta">{formatRange(startDate, endDate)}</p>
        </div>
        <span className={CLASE_RESUMEN[resumenEstado(summary)]}>
          {resumenLabel(summary)}
        </span>
      </div>

      {tasks.length > 0 && (
        // list-style: none le quita la semántica de lista en Safari/VoiceOver.
        <ul className="prep__tareas" role="list">
          {tasks.map((tarea) => (
            <RentalPreparationTask
              key={tarea.id}
              tarea={tarea}
              coowners={coowners}
              ocupada={guardando.includes(tarea.id)}
              onTildar={tildar}
              onReasignar={reasignar}
              onEliminar={eliminar}
            />
          ))}
        </ul>
      )}

      {erroresCambio.length > 0 && (
        <ul className="alq-err prep__errores" role="alert">
          {erroresCambio.map((mensaje) => (
            <li key={mensaje}>{mensaje}</li>
          ))}
        </ul>
      )}
      {/* Siempre montada, como la del formulario: anuncia "Tarea eliminada". */}
      <p className="solo-lector" role="status">
        {avisoCambio}
      </p>

      {/* Un alquiler que terminó ya no recibe tareas. */}
      {puedeAgregar && (
        <form className="prep__alta" onSubmit={enviar} noValidate>
          <div className="prep__alta-campos">
            <label className="solo-lector" htmlFor={campoNombre}>
              Nombre de la nueva tarea
            </label>
            <input
              ref={nombreRef}
              id={campoNombre}
              className="in prep__alta-nombre"
              type="text"
              placeholder="Nueva tarea de preparación"
              autoComplete="off"
              value={nombre}
              onChange={editar(setNombre)}
              aria-invalid={conError('nombre') || undefined}
              aria-describedby={errores.length > 0 ? listaErrores : undefined}
            />

            <label className="solo-lector" htmlFor={campoResponsable}>
              Responsable de la nueva tarea
            </label>
            <select
              id={campoResponsable}
              className="sel"
              value={responsableId}
              onChange={editar(setResponsableId)}
              aria-invalid={conError('responsable') || undefined}
              aria-describedby={errores.length > 0 ? listaErrores : undefined}
            >
              <option value="">Responsable</option>
              {coowners.map((copropietario) => (
                <option key={copropietario.id} value={copropietario.id}>
                  {copropietario.name}
                </option>
              ))}
            </select>

            <button type="submit" className="btn btn--primary" disabled={enviando}>
              Agregar
            </button>
          </div>

          {errores.length > 0 && (
            <ul id={listaErrores} className="alq-err prep__errores" role="alert">
              {errores.map((mensaje) => (
                <li key={mensaje}>{mensaje}</li>
              ))}
            </ul>
          )}
          {/* Siempre montada: varios lectores de pantalla no anuncian una región
              live que aparece ya con su texto. */}
          <p className="solo-lector" role="status">
            {confirmacion}
          </p>
        </form>
      )}
    </article>
  )
}

export default RentalPreparationCard
