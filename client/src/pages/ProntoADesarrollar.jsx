import './ProntoADesarrollar.css'

// Placeholder para las secciones que todavía no tienen su historia implementada.
function ProntoADesarrollar({ titulo }) {
  return (
    <section className="pronto">
      <h1 className="pronto-titulo">{titulo}</h1>
      <p className="pronto-mensaje">Pronto a desarrollar.</p>
    </section>
  )
}

export default ProntoADesarrollar
