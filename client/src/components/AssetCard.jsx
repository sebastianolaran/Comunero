import { iniciales, textoEstadia, textoIntegrantes, textoPendientes } from '../lib/assets'
import { colorDeIntegrante } from '../lib/calendar'
import Icono from './Iconos'

// Tarjeta de un bien en "Tus bienes compartidos". Toda la tarjeta entra al bien.
function AssetCard({ bien, onElegir }) {
  const pendientes = textoPendientes(bien.pendingVotes)

  return (
    <button type="button" className="bien" onClick={() => onElegir(bien)}>
      <span className="bien__cab">
        <span className="bien__n">{bien.name}</span>
        <Icono nombre="flecha" className="bien__flecha" />
      </span>
      <span className="bien__cant">{textoIntegrantes(bien.members.length)}</span>

      <span className="bien__av" aria-label={bien.members.map((m) => m.name).join(', ')}>
        {bien.members.map((m) => (
          <span key={m.id} className="bien__a" style={{ background: colorDeIntegrante(m.id, m.hue) }} title={m.name}>
            {iniciales(m.name)}
          </span>
        ))}
      </span>

      <span className="bien__pie">
        <span className="bien__estado">{textoEstadia(bien.stay)}</span>
        {pendientes && <span className="bien__pend">{pendientes}</span>}
      </span>
    </button>
  )
}

export default AssetCard
