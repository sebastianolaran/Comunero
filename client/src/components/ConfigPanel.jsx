import { useId, useLayoutEffect, useRef, useState } from 'react'

// Botón "i" con la explicación: se abre al pasar el mouse, con foco o con un
// toque (mobile), y se cierra al salir, al tocar afuera o con Escape. El click
// no alterna: el foco ya la abrió y alternar la cerraría en el mismo toque. El
// texto queda siempre en el DOM para que aria-describedby lo lea cerrado.
const MARGEN_PANTALLA = 16

export function Ayuda({ texto }) {
  const id = useId()
  const [abierta, setAbierta] = useState(false)
  const pop = useRef(null)

  // En pantallas angostas el globo se saldría por la derecha: se corre lo justo.
  useLayoutEffect(() => {
    const el = pop.current
    if (!abierta || !el) return
    el.style.translate = ''
    const sobra = el.getBoundingClientRect().right - (window.innerWidth - MARGEN_PANTALLA)
    if (sobra > 0) el.style.translate = `${-sobra}px 0`
  }, [abierta])

  return (
    <span className="cfg__ayuda" onMouseEnter={() => setAbierta(true)} onMouseLeave={() => setAbierta(false)}>
      <button
        type="button"
        className="idot"
        aria-label="Qué hace"
        aria-describedby={id}
        aria-expanded={abierta}
        onClick={() => setAbierta(true)}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
        onKeyDown={(e) => e.key === 'Escape' && setAbierta(false)}
      >
        i
      </button>
      <span ref={pop} id={id} role="tooltip" className="pop cfg__pop" hidden={!abierta}>
        {texto}
      </span>
    </span>
  )
}

export function Panel({ titulo, ayuda, hint, children, pie }) {
  const id = useId()
  return (
    <section className="panel cfg__p" aria-labelledby={id}>
      <div className="cfg__head">
        <div className="cfg__titulo">
          <h2 id={id} className="sect">
            {titulo}
          </h2>
          {ayuda && <Ayuda texto={ayuda} />}
        </div>
        {hint && <p className="hint">{hint}</p>}
      </div>
      {children}
      {pie}
    </section>
  )
}

// Guardar solo se activa con cambios sin guardar, y "Guardado" se ve mientras
// lo que está en pantalla es lo guardado: editar de nuevo lo saca.
export function Pie({ estado, onGuardar, sinCambios, children }) {
  return (
    <div className="cfg__pie">
      {estado.error && (
        <p className="cfg__error" role="alert">
          {estado.error}
        </p>
      )}
      {!estado.error && estado.guardado && sinCambios && (
        <p className="cfg__estado" role="status">
          Guardado
        </p>
      )}
      {children}
      <button
        type="button"
        className="btn btn--sm btn--primary"
        disabled={estado.guardando || sinCambios}
        onClick={onGuardar}
      >
        {estado.guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}

