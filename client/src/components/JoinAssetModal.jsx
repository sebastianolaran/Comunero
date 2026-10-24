import { useId, useState } from 'react'
import { validarCodigo } from '../lib/assets'
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'

function JoinAssetModal({ abierto, onClose, onJoin, onIr }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [yaEstaba, setYaEstaba] = useState(null)
  const id = useId()

  function limpiar() {
    setCodigo('')
    setError(null)
    setEnviando(false)
    setYaEstaba(null)
  }

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
    <Modal
      abierto={abierto}
      titulo={yaEstaba ? `“${yaEstaba.name}” ya está en la lista de bienes` : 'Unirse a un bien'}
      subtitulo={
        yaEstaba
          ? 'Ese código es de un bien de la lista. No cambió nada.'
          : 'El código lo tiene cualquier integrante del grupo.'
      }
      onAbrir={limpiar}
      onClose={onClose}
    >
      {yaEstaba ? (
        <ModalAcciones>
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onIr(yaEstaba)}>
            Ir al calendario
          </button>
        </ModalAcciones>
      ) : (
        <form onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor={`${id}-codigo`} className="lbl">
              Código del bien
            </label>
            <input
              id={`${id}-codigo`}
              className="in bienes-in--codigo"
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
            <FieldError id={`${id}-error`}>{error}</FieldError>
          </div>
          <ModalAcciones>
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Uniendo…' : 'Unirse'}
            </button>
          </ModalAcciones>
        </form>
      )}
    </Modal>
  )
}

export default JoinAssetModal
