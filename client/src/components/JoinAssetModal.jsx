import { useEffect, useId, useRef, useState } from 'react'
import { validarCodigo } from '../lib/assets'

function JoinAssetModal({ abierto, onClose, onJoin, onIr }) {
  const dialogo = useRef(null)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [yaEstaba, setYaEstaba] = useState(null)
  const id = useId()

  useEffect(() => {
    const d = dialogo.current
    if (abierto && !d.open) {
      setCodigo('')
      setError(null)
      setEnviando(false)
      setYaEstaba(null)
      d.showModal()
    }
    if (!abierto && d.open) d.close()
  }, [abierto])

  async function enviar(e) {
    e.preventDefault()
    const validacion = validarCodigo(codigo)
    if (validacion.error) {
      setError(validacion.error)
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const { asset, alreadyMember } = await onJoin(validacion.codigo)
      if (alreadyMember) setYaEstaba(asset)
      else onIr(asset)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <dialog
      ref={dialogo}
      className="modal bienes-modal"
      aria-labelledby={`${id}-t`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogo.current) onClose()
      }}
    >
      {yaEstaba ? (
        <div>
          <h2 id={`${id}-t`} className="bienes-modal__t">
            Ya sos parte de “{yaEstaba.name}”
          </h2>
          <p className="bienes-modal__s">Ese código es de un bien en el que ya estás. No cambió nada.</p>
          <div className="bienes-acciones">
            <button type="button" className="btn" onClick={onClose}>
              Cerrar
            </button>
            <button type="button" className="btn btn--primary" onClick={() => onIr(yaEstaba)}>
              Ir al calendario
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate>
          <h2 id={`${id}-t`} className="bienes-modal__t">
            Unirme a un bien
          </h2>
          <p className="bienes-modal__s">Pedile el código a alguien que ya esté en el grupo.</p>
          <label htmlFor={`${id}-codigo`} className="bienes-lbl">
            Código del bien
          </label>
          <input
            id={`${id}-codigo`}
            className="in bienes-in bienes-in--codigo"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="EJ: QNT-7K4P"
            maxLength={12}
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value.toUpperCase())
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          {error && (
            <p id={`${id}-error`} className="bienes-err" role="alert">
              {error}
            </p>
          )}
          <div className="bienes-acciones">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Uniendo…' : 'Unirme'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}

export default JoinAssetModal
