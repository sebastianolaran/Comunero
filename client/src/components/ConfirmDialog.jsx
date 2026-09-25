import { useEffect, useId, useRef } from 'react'

// Modal de confirmación para acciones que no se pueden deshacer. Se monta ya
// abierto; Escape, el botón Cancelar y un clic afuera lo cierran sin hacer nada.
function ConfirmDialog({ title, lines, confirmLabel, busyLabel, busy, error, onConfirm, onCancel }) {
  const dialogo = useRef(null)
  const cancelar = useRef(null)
  const id = useId()

  useEffect(() => {
    dialogo.current.showModal()
    cancelar.current.focus()
  }, [])

  return (
    <dialog
      ref={dialogo}
      className="modal"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-texto`}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === dialogo.current) onCancel()
      }}
    >
      <h2 id={`${id}-titulo`} className="modal__t">
        {title}
      </h2>
      <div id={`${id}-texto`} className="mov-confirm">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {error && (
        <p className="mov-err mov-campo" role="alert">
          {error}
        </p>
      )}
      <div className="mov-acciones">
        <button ref={cancelar} type="button" className="btn btn--grow" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn btn--grow btn--danger" onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

export default ConfirmDialog
