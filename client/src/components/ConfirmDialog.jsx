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
      className="mov-modal mov-modal-sm"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-texto`}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === dialogo.current) onCancel()
      }}
    >
      <h2 id={`${id}-titulo`} className="mov-modal-title">
        {title}
      </h2>
      <div id={`${id}-texto`} className="mov-confirm-text">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {error && (
        <p className="mov-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="mov-modal-actions">
        <button ref={cancelar} type="button" className="mov-btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="mov-btn mov-btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

export default ConfirmDialog
