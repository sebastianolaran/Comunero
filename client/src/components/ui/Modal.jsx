import { useEffect, useEffectEvent, useId, useRef } from 'react'

// <dialog> nativo con la piel del sistema. Con `abierto` controlado se abre y
// se cierra desde afuera; sin él se monta ya abierto. Escape, el clic afuera
// y onClose de los botones lo cierran. onAbrir corre justo antes de abrirlo
// (para limpiar el formulario) y `foco` es el elemento que recibe el foco.
function Modal({ abierto = true, icono, titulo, subtitulo, describedBy, ancho, foco, onAbrir, onClose, children }) {
  const dialogo = useRef(null)
  const id = useId()

  const abrir = useEffectEvent((d) => {
    onAbrir?.()
    d.showModal()
    foco?.current?.focus()
  })

  useEffect(() => {
    const d = dialogo.current
    if (abierto && !d.open) abrir(d)
    if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog
      ref={dialogo}
      className={ancho ? `modal modal--${ancho}` : 'modal'}
      aria-labelledby={`${id}-titulo`}
      aria-describedby={describedBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogo.current) onClose()
      }}
    >
      {icono && (
        <span className="modal__i" aria-hidden="true">
          {icono}
        </span>
      )}
      <h2 id={`${id}-titulo`} className="modal__t">
        {titulo}
      </h2>
      {subtitulo && <p className="modal__s">{subtitulo}</p>}
      {children}
    </dialog>
  )
}

// Cancelar a la izquierda, la acción a la derecha, los dos del mismo ancho.
export function ModalAcciones({ children }) {
  return <div className="modal__acciones">{children}</div>
}

export default Modal
