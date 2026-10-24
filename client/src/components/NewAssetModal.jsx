import { useId, useState } from 'react'
import { MAX_NOMBRE_BIEN, validarNombreBien } from '../lib/assets'
import { useCopiado } from '../lib/useCopiado'
import Icono from './Iconos'
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'

// Dos pasos en el mismo diálogo: el nombre y, ya creado, el código.
function NewAssetModal({ abierto, onClose, onCreate, onIr }) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState(null)
  const { copiado, copiar } = useCopiado()
  const id = useId()

  function limpiar() {
    setNombre('')
    setError(null)
    setEnviando(false)
    setCreado(null)
  }

  async function enviar(e) {
    e.preventDefault()
    const validacion = validarNombreBien(nombre)
    if (validacion.error) {
      setError(validacion.error)
      return
    }
    setEnviando(true)
    setError(null)
    try {
      setCreado(await onCreate(validacion.nombre))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      icono={creado && <Icono nombre="check" />}
      titulo={creado ? `Bien creado: “${creado.name}”` : 'Nuevo bien compartido'}
      subtitulo={
        creado
          ? 'Con este código, desde “Unirse con código”, el resto del grupo se suma al bien.'
          : 'Un nombre que el grupo reconozca. Después se genera un código para que se sumen.'
      }
      onAbrir={limpiar}
      onClose={onClose}
    >
      {creado ? (
        <>
          <div className="bienes-codigo">
            <output className="bienes-codigo__v" aria-label="Código del bien">
              {creado.inviteCode}
            </output>
            <button type="button" className="btn btn--primary bienes-codigo__b" onClick={() => copiar(creado.inviteCode)}>
              <Icono nombre={copiado ? 'check' : 'copiar'} />
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="hint bienes-modal__nota">
            El código queda siempre en el menú del bien, debajo del nombre, por si se suma alguien más.
          </p>
          <ModalAcciones>
            <button type="button" className="btn" onClick={() => onIr(creado)}>
              Ir al calendario
            </button>
          </ModalAcciones>
        </>
      ) : (
        <form onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor={`${id}-nombre`} className="lbl">
              Nombre del bien
            </label>
            <input
              id={`${id}-nombre`}
              className="in"
              autoComplete="off"
              placeholder="Ej: Casa quinta, Lancha, Depto en la costa"
              maxLength={MAX_NOMBRE_BIEN + 20}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
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
              {enviando ? 'Creando…' : 'Crear bien'}
            </button>
          </ModalAcciones>
        </form>
      )}
    </Modal>
  )
}

export default NewAssetModal
