import { useState } from 'react'
import { colorConfirmado } from '../../lib/calendar'
import { chipVoto } from '../../lib/rentalRequests'
import { useTonos } from '../../lib/useTonos'

const CLASE_CHIP = { aprobo: 'chip chip--yes', rechazo: 'chip chip--no', pendiente: 'chip chip--none' }

// Quién votó y quién falta. El ícono del chip (tilde, cruz o punto) es
// decorativo: el voto se lee en el texto oculto.
// Un voto que cambia mientras se mira la lista (el propio o el de alguien que
// llega al recargar) se marca con chip--llega; al cargar la pantalla, no.
function useVotosQueLlegan(votes) {
  const [previos, setPrevios] = useState(votes)
  const [llegan, setLlegan] = useState(() => new Set())
  // Patrón de React para comparar con el render anterior sin un efecto.
  if (votes !== previos) {
    const antes = new Map(previos.map((v) => [v.userId, v.value]))
    setLlegan(new Set(votes.filter((v) => antes.has(v.userId) && antes.get(v.userId) !== v.value).map((v) => v.userId)))
    setPrevios(votes)
  }
  return llegan
}

export function ChipsVoto({ votes, cerrada = false }) {
  const tonos = useTonos()
  const llegan = useVotosQueLlegan(votes)
  return (
    <ul className="chips-voto">
      {votes.map((v) => {
        const { descripcion, variante } = chipVoto(v, cerrada)
        return (
          <li key={v.userId} className={llegan.has(v.userId) ? `${CLASE_CHIP[variante]} chip--llega` : CLASE_CHIP[variante]}>
            <span className="persona__d" style={{ background: colorConfirmado(v.userId, tonos[v.userId]) }} aria-hidden="true" />
            <span aria-hidden="true">{v.name}</span>
            <span className="solo-lector">{descripcion}</span>
          </li>
        )
      })}
    </ul>
  )
}
