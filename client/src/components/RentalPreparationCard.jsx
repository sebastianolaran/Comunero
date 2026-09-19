import { useId, useRef, useState } from 'react'
import { formatRange, resumenEstado, resumenLabel, validarTarea } from '../lib/rentalPreparations'
import { createRentalTask } from '../services/rentalPreparation'
import './RentalPreparationCard.css'

// Tarjeta de un alquiler aprobado: inquilino, fechas, resumen, tareas y, si el
// alquiler no terminó, el formulario para agregar una tarea.
// `alquiler` es un elemento de GET /api/rental-preparations; `onTareaCreada`
// recibe (alquilerId, tarea) cuando el server confirma el alta.
function RentalPreparationCard({ alquiler, onTareaCreada }) {
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
  const campoNombre = useId()
  const campoResponsable = useId()
  const listaErrores = useId()

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
    <article className="preparacion">
      <div className="preparacion-cabecera">
        <div>
          <h2 className="preparacion-nombre">{renterName ?? 'Sin interesado'}</h2>
          <p className="preparacion-fechas">{formatRange(startDate, endDate)}</p>
        </div>
        <span className={`preparacion-resumen is-${resumenEstado(summary)}`}>
          {resumenLabel(summary)}
        </span>
      </div>

      {tasks.length > 0 && (
        // list-style: none le quita la semántica de lista en Safari/VoiceOver.
        <ul className="preparacion-tareas" role="list">
          {tasks.map((tarea) => (
            <li
              key={tarea.id}
              className={['preparacion-tarea', tarea.completed && 'is-hecha'].filter(Boolean).join(' ')}
            >
              {/* El tilde y el tachado no los lee un lector de pantalla: el estado
                  va también como texto. */}
              <span className="preparacion-casilla" aria-hidden="true">
                {tarea.completed ? '✓' : ''}
              </span>
              <span className="preparacion-tarea-nombre">
                <span className="preparacion-oculto">{tarea.completed ? 'Hecha: ' : 'Pendiente: '}</span>
                {tarea.name}
              </span>
              <span className="preparacion-responsable">Responsable: {tarea.assignedTo.name}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Un alquiler que terminó ya no recibe tareas. */}
      {puedeAgregar && (
        <form className="preparacion-alta" onSubmit={enviar} noValidate>
          <div className="preparacion-alta-campos">
            <label className="preparacion-oculto" htmlFor={campoNombre}>
              Nombre de la nueva tarea
            </label>
            <input
              ref={nombreRef}
              id={campoNombre}
              className="preparacion-alta-nombre"
              type="text"
              placeholder="Nueva tarea"
              autoComplete="off"
              value={nombre}
              onChange={editar(setNombre)}
              aria-invalid={conError('nombre') || undefined}
              aria-describedby={errores.length > 0 ? listaErrores : undefined}
            />

            <label className="preparacion-oculto" htmlFor={campoResponsable}>
              Responsable de la nueva tarea
            </label>
            <select
              id={campoResponsable}
              className="preparacion-alta-responsable"
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

            <button type="submit" className="preparacion-alta-boton" disabled={enviando}>
              Agregar
            </button>
          </div>

          {errores.length > 0 && (
            <ul id={listaErrores} className="preparacion-alta-errores" role="alert">
              {errores.map((mensaje) => (
                <li key={mensaje}>{mensaje}</li>
              ))}
            </ul>
          )}
          {/* Siempre montada: varios lectores de pantalla no anuncian una región
              live que aparece ya con su texto. */}
          <p className="preparacion-oculto" role="status">
            {confirmacion}
          </p>
        </form>
      )}
    </article>
  )
}

export default RentalPreparationCard
