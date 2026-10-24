import { colorDeIntegrante } from '../../lib/calendar'
import { chipVoto } from '../../lib/rentalRequests'
import { useTonos } from '../../lib/useTonos'

const CLASE_CHIP = { aprobo: 'chip chip--yes', rechazo: 'chip chip--no', pendiente: 'chip chip--none' }

// Quién votó y quién falta. El ícono del chip (tilde, cruz o punto) es
// decorativo: el voto se lee en el texto oculto.
export function ChipsVoto({ votes }) {
  const tonos = useTonos()
  return (
    <ul className="chips-voto">
      {votes.map((v) => {
        const { descripcion, variante } = chipVoto(v)
        return (
          <li key={v.userId} className={CLASE_CHIP[variante]}>
            <span className="persona__d" style={{ background: colorDeIntegrante(v.userId, tonos[v.userId]) }} aria-hidden="true" />
            <span aria-hidden="true">{v.name}</span>
            <span className="solo-lector">{descripcion}</span>
          </li>
        )
      })}
    </ul>
  )
}
