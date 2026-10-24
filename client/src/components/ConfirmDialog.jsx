import { useId, useRef } from 'react'
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'

// Confirmación de una acción. Se monta ya abierta con el foco en Cancelar.
// `tono="peligro"` para lo que no se deshace (eliminar, salir del bien); para
// confirmar algo positivo, como un pago, el botón va en tinta.
function ConfirmDialog({ title, lines, confirmLabel, busyLabel, busy, error, tono = 'peligro', onConfirm, onCancel }) {
  const cancelar = useRef(null)
  const id = useId()

  return (
    <Modal titulo={title} describedBy={`${id}-texto`} foco={cancelar} onClose={onCancel}>
      <div id={`${id}-texto`} className="modal__texto">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <FieldError>{error}</FieldError>
      <ModalAcciones>
        <button ref={cancelar} type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={tono === 'peligro' ? 'btn btn--danger' : 'btn btn--primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </ModalAcciones>
    </Modal>
  )
}

export default ConfirmDialog
