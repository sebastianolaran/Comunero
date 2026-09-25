import './RentalPreparationCard.css'

// Una tarea del listado: tilde, nombre, responsable y botón de eliminar.
// Los controles se ven siempre, aun con el alquiler terminado: el server es quien
// rechaza el cambio y la tarjeta muestra el error.
// `coowners` puede faltar si el client llega antes que el server (se despliegan
// aparte): sin la lista no hay a quién reasignar y el responsable va como texto.
// Mientras se guarda (`ocupada`) los controles NO se deshabilitan: el navegador le
// saca el foco a un control que pasa a `disabled` y quien usa el teclado volvería
// al principio de la página. La tarjeta ignora los cambios de una tarea ocupada.
function RentalPreparationTask({ tarea, coowners, ocupada, onTildar, onReasignar, onEliminar }) {
  const { name, completed, assignedTo } = tarea

  return (
    <li
      className="prep__tarea"
      aria-busy={ocupada || undefined}
    >
      {/* El checkbox es nativo: el lector de pantalla anuncia solo si está hecha. */}
      <label className="prep__tarea-nombre">
        <input
          type="checkbox"
          checked={completed}
          onChange={(evento) => onTildar(tarea, evento.target.checked)}
        />
        <span className={completed ? 'task__t task__t--done' : 'task__t'}>{name}</span>
      </label>

      {Array.isArray(coowners) ? (
        <select
          className="sel"
          aria-label={`Responsable de ${name}`}
          value={assignedTo.id}
          onChange={(evento) => onReasignar(tarea, evento.target.value)}
        >
          {coowners.map((copropietario) => (
            <option key={copropietario.id} value={copropietario.id}>
              {copropietario.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="meta">Responsable: {assignedTo.name}</span>
      )}

      <button
        type="button"
        className="btn btn--sm btn--bare prep__eliminar"
        aria-label={`Eliminar tarea ${name}`}
        onClick={() => onEliminar(tarea)}
      >
        Eliminar
      </button>
    </li>
  )
}

export default RentalPreparationTask
