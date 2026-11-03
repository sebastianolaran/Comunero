import FieldError from './ui/FieldError'
import { Vacio } from './ui/Estado'
import { agruparIntercambios, textoEstado, textoTurno } from '../lib/swaps'

function Item({ swap, children }) {
  return (
    <li className="card card--pad res-swap">
      <div className="res-voto__cab">
        <strong>
          {swap.proposedBy.name} ⇄ {swap.recipient.name}
        </strong>
        {swap.status !== 'PENDING' && <span className="meta">{textoEstado(swap)}</span>}
      </div>
      <p className="meta">
        {swap.proposedBy.name}: {textoTurno(swap.offered)}
      </p>
      <p className="meta">
        {swap.recipient.name}: {textoTurno(swap.requested)}
      </p>
      {swap.closedReason && <p className="res-motivo">{swap.closedReason}.</p>}
      {children && <div className="res-voto__acciones">{children}</div>}
    </li>
  )
}

function Grupo({ titulo, children }) {
  return (
    <section className="res-grupo">
      <h2 className="sect">{titulo}</h2>
      <ul className="res-votar" role="list">
        {children}
      </ul>
    </section>
  )
}

// Intercambios de turnos entre pares: no se votan, alcanza con que acepte quien
// recibe la propuesta. Los resueltos quedan como historial del bien.
function Intercambios({ swaps, userId, error, ocupado, onResponder, onRetirar }) {
  const { recibidos, propuestos, otros, resueltos } = agruparIntercambios(swaps, userId)
  const pendientes = [...propuestos, ...otros]

  return (
    <>
      <p className="hint res-regla">
        Cambio de un turno aprobado por otro de igual cantidad de días. No pasa por votación: alcanza con que acepten las dos
        partes. Se propone desde la lista de Reservas, en el turno de la otra persona.
      </p>
      <FieldError>{error}</FieldError>
      {swaps.length === 0 && <Vacio panel titulo="Todavía no hubo intercambios." />}
      {recibidos.length > 0 && (
        <Grupo titulo="Esperan la respuesta propia">
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
        </Grupo>
      )}
      {pendientes.length > 0 && (
        <Grupo titulo="Pendientes">
          {pendientes.map((swap) => (
            <Item key={swap.id} swap={swap}>
              <span className="tag tag--dash">Esperando a {swap.recipient.name}</span>
              {swap.proposedBy.id === userId && (
                <button type="button" className="btn btn--sm" disabled={ocupado} onClick={() => onRetirar(swap)}>
                  Retirar
                </button>
              )}
            </Item>
          ))}
        </Grupo>
      )}
      {resueltos.length > 0 && (
        <Grupo titulo="Historial">
          {resueltos.map((swap) => (
            <Item key={swap.id} swap={swap} />
          ))}
        </Grupo>
      )}
    </>
  )
}

export default Intercambios
