import { useId, useState } from 'react'
import { CAMPO_DEL_SERVER, validarDecision } from '../lib/decisions'
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'

const VACIO = { titulo: '', monto: '' }

// onCreate(decision) tiene que tirar un Error (con .field si es de un campo) si el alta falla.
function NewDecisionModal({ abierto, onClose, onCreate }) {
  const [borrador, setBorrador] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  const id = useId()

  function limpiar() {
    setBorrador(VACIO)
    setErrores({})
    setEnvio({ enviando: false, error: null })
  }

  const cambiar = (campo) => (e) => {
    const valor = e.target.value
    setBorrador((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: undefined }))
  }

  async function enviar(e) {
    e.preventDefault()
    const validacion = validarDecision(borrador)
    if (validacion.errores) {
      setErrores(validacion.errores)
      return
    }
    setEnvio({ enviando: true, error: null })
    try {
      await onCreate(validacion.decision)
    } catch (err) {
      const campo = CAMPO_DEL_SERVER[err.field]
      if (campo) setErrores({ [campo]: err.message })
      setEnvio({ enviando: false, error: campo ? null : err.message })
    }
  }

  const campo = (nombre, label, props) => {
    const idCampo = `${id}-${nombre}`
    const error = errores[nombre]
    return (
      <div className="campo">
        <label htmlFor={idCampo} className="lbl">
          {label}
        </label>
        <input
          id={idCampo}
          name={nombre}
          className="in"
          autoComplete="off"
          value={borrador[nombre]}
          onChange={cambiar(nombre)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${idCampo}-error` : undefined}
          {...props}
        />
        <FieldError id={`${idCampo}-error`}>{error}</FieldError>
      </div>
    )
  }

  return (
    <Modal abierto={abierto} titulo="Nueva decisión" onAbrir={limpiar} onClose={onClose}>
      <form onSubmit={enviar} noValidate>
        {campo('titulo', 'Título', { placeholder: 'Ej: Cambiar el calefón', maxLength: 150 })}
        {campo('monto', 'Monto estimado (opcional)', { inputMode: 'numeric', placeholder: '0', maxLength: 20 })}

        <FieldError>{envio.error}</FieldError>

        <ModalAcciones>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={envio.enviando}>
            {envio.enviando ? 'Creando…' : 'Crear'}
          </button>
        </ModalAcciones>
      </form>
    </Modal>
  )
}

export default NewDecisionModal
