import FieldError from './ui/FieldError'
import { agruparIntercambios, textoEstado, textoTurno } from '../lib/swaps'

function Turnos({ swap }) {
  return (
    <span className="cal-swap__turnos">
      <span>{swap.proposedBy.name}: {textoTurno(swap.offered)}</span>
      <span>{swap.recipient.name}: {textoTurno(swap.requested)}</span>
    </span>
  )
}

function Item({ swap, children }) {
  return (
    <li className="cal-pending__item">
      <span className="cal-pending__title">
        <strong>{swap.proposedBy.name} ⇄ {swap.recipient.name}</strong>
        {swap.status !== 'PENDING' && <span className="meta">{textoEstado(swap)}</span>}
      </span>
      <Turnos swap={swap} />
      {swap.closedReason && <span className="cal-swap__motivo">{swap.closedReason}.</span>}
      {children && <div className="cal-pending__actions">{children}</div>}
    </li>
  )
}

// Intercambios de turnos entre pares: no se votan, alcanza con que acepte quien
// recibe la propuesta. Los resueltos quedan como historial del bien.
function Intercambios({ swaps, userId, error, ocupado, onResponder, onRetirar }) {
  const { recibidos, propuestos, otros, resueltos } = agruparIntercambios(swaps, userId)
  const pendientes = recibidos.length + propuestos.length + otros.length

  return (
    <section className="panel cal-pending" aria-label="Intercambios de turnos">
      <header className="cal-pending__head">
        <h2 className="cal-pending__t">Intercambios{pendientes > 0 && ` (${pendientes} pendientes)`}</h2>
      </header>
      <p className="hint cal-pending__hint">
        Cambio de un turno aprobado por otro de igual cantidad de días. No pasa por votación: alcanza con que acepten las dos partes.
      </p>
      <FieldError>{error}</FieldError>
      <ul className="cal-pending__list" role="list">
        {recibidos.map((swap) => (
          <Item key={swap.id} swap={swap}>
            <button type="button" className="btn btn--sm btn--primary" disabled={ocupado} onClick={() => onResponder(swap, 'ACCEPT')}>
              Aceptar
            </button>
            <button type="button" className="btn btn--sm" disabled={ocupado} onClick={() => onResponder(swap, 'REJECT')}>
              Rechazar
            </button>
          </Item>
        ))}
        {propuestos.map((swap) => (
          <Item key={swap.id} swap={swap}>
            <span className="tag tag--dash">Esperando a {swap.recipient.name}</span>
            <button type="button" className="btn btn--sm" disabled={ocupado} onClick={() => onRetirar(swap)}>
              Retirar
            </button>
          </Item>
        ))}
        {otros.map((swap) => (
          <Item key={swap.id} swap={swap}>
            <span className="tag tag--dash">Pendiente</span>
          </Item>
        ))}
        {resueltos.map((swap) => (
          <Item key={swap.id} swap={swap} />
        ))}
      </ul>
    </section>
  )
}

export default Intercambios
