import { useEffect, useId, useRef, useState } from 'react'
import { CAMPO_DEL_SERVER, validarDecision } from '../lib/decisions'

const VACIO = { titulo: '', monto: '' }

// onCreate(decision) tiene que tirar un Error (con .field si es de un campo) si el alta falla.
function NewDecisionModal({ abierto, onClose, onCreate }) {
  const dialogo = useRef(null)
  const [borrador, setBorrador] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  const id = useId()
  const idTitulo = `${id}-encabezado`

  useEffect(() => {
    const d = dialogo.current
    if (abierto && !d.open) {
      setBorrador(VACIO)
      setErrores({})
      setEnvio({ enviando: false, error: null })
      d.showModal()
    }
    if (!abierto && d.open) d.close()
  }, [abierto])

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
      <div className="nueva-decision-campo">
        <label htmlFor={idCampo} className="nueva-decision-label">
          {label}
        </label>
        <input
          id={idCampo}
          name={nombre}
          className="nueva-decision-input"
          autoComplete="off"
          value={borrador[nombre]}
          onChange={cambiar(nombre)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${idCampo}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${idCampo}-error`} className="nueva-decision-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <dialog
      ref={dialogo}
      className="nueva-decision"
      aria-labelledby={idTitulo}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogo.current) onClose()
      }}
    >
      <form onSubmit={enviar} noValidate>
        <h2 id={idTitulo} className="nueva-decision-titulo">
          Nueva decisión
        </h2>

        {campo('titulo', 'Título', { placeholder: 'Ej: Cambiar el calefón', maxLength: 150 })}
        {campo('monto', 'Monto estimado (opcional)', { inputMode: 'numeric', placeholder: '0', maxLength: 20 })}

        {envio.error && (
          <p className="nueva-decision-error is-general" role="alert">
            {envio.error}
          </p>
        )}

        <div className="nueva-decision-acciones">
          <button type="button" className="nueva-decision-boton" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="nueva-decision-boton is-primario" disabled={envio.enviando}>
            {envio.enviando ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default NewDecisionModal
