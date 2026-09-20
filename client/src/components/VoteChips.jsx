import { chipVoto } from '../lib/rentalRequests'

function VoteChips({ votes }) {
  return (
    <ul className="voto-chips">
      {votes.map((v) => {
        const { label, descripcion, variante } = chipVoto(v)
        return (
          <li key={v.userId} className={`voto-chip is-${variante}`}>
            <span aria-hidden="true">{label}</span>
            <span className="solo-lector">{descripcion}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default VoteChips
