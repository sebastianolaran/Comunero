// Píldoras para filtrar una lista en el lugar. Para alternar entre modos de
// un mismo formulario (Gasto / Ingreso) va el control segmentado, no esto.
function Filtros({ opciones, valor, onChange, etiqueta }) {
  return (
    <div className="filtros" role="group" aria-label={etiqueta}>
      {opciones.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={valor === id ? 'pill pill--on' : 'pill'}
          aria-pressed={valor === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default Filtros
