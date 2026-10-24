import { chipVoto } from '../../lib/rentalRequests'

const CLASE_CHIP = { aprobo: 'chip chip--yes', rechazo: 'chip chip--no', pendiente: 'chip chip--none' }

// Quién votó y quién falta. El ícono del chip (tilde, cruz o punto) es
// decorativo: el voto se lee en el texto oculto.
export function ChipsVoto({ votes }) {
  return (
    <ul className="chips-voto">
      {votes.map((v) => {
        const { descripcion, variante } = chipVoto(v)
        return (
          <li key={v.userId} className={CLASE_CHIP[variante]}>
            <span aria-hidden="true">{v.name}</span>
            <span className="solo-lector">{descripcion}</span>
          </li>
        )
      })}
    </ul>
  )
}
