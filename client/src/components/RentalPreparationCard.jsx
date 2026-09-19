import { formatRange, resumenEstado, resumenLabel } from '../lib/rentalPreparations'
import './RentalPreparationCard.css'

// Tarjeta de un alquiler aprobado: inquilino, fechas, resumen y tareas.
// Solo lectura. `alquiler` es un elemento de GET /api/rental-preparations.
function RentalPreparationCard({ alquiler }) {
  const { renterName, startDate, endDate, tasks, summary } = alquiler

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
    </article>
  )
}

export default RentalPreparationCard
