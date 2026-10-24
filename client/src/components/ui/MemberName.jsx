import { colorDeIntegrante } from '../../lib/calendar'

// Nombre de un integrante con su color: el mismo punto que en el calendario
// y en Configuración, para reconocer a cada uno en toda la app.
function MemberName({ id, name, tonos = {} }) {
  return (
    <span className="persona">
      <span className="persona__d" style={{ background: colorDeIntegrante(id, tonos[id]) }} aria-hidden="true" />
      {name}
    </span>
  )
}

export default MemberName
