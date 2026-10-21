import { useEffect, useId, useRef, useState } from 'react'
import { MAX_NOMBRE_BIEN, validarNombreBien } from '../lib/assets'
import { useCopiado } from '../lib/useCopiado'
import Icono from './Iconos'

// Dos pasos en el mismo diálogo: el nombre y, ya creado, el código.
function NewAssetModal({ abierto, onClose, onCreate, onIr }) {
  const dialogo = useRef(null)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState(null)
  const { copiado, copiar } = useCopiado()
  const id = useId()

  useEffect(() => {
    const d = dialogo.current
    if (abierto && !d.open) {
      setNombre('')
      setError(null)
      setEnviando(false)
      setCreado(null)
      d.showModal()
    }
    if (!abierto && d.open) d.close()
  }, [abierto])

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
    <dialog
      ref={dialogo}
      className="modal bienes-modal"
      aria-labelledby={`${id}-t`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogo.current) onClose()
      }}
    >
      {creado ? (
        <div className="bienes-ok">
          <span className="bienes-ok__i" aria-hidden="true">
            <Icono nombre="check" />
          </span>
          <h2 id={`${id}-t`} className="bienes-modal__t">
            Creaste “{creado.name}”
          </h2>
          <p className="bienes-modal__s">
            Pasales este código a tus amigos. Con él, desde “Unirme con código”, se suman al bien.
          </p>
          <div className="bienes-codigo">
            <output className="bienes-codigo__v" aria-label="Código del bien">
              {creado.inviteCode}
            </output>
            <button type="button" className="btn btn--primary bienes-codigo__b" onClick={() => copiar(creado.inviteCode)}>
              <Icono nombre={copiado ? 'check' : 'copiar'} />
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="bienes-modal__nota">
            Lo vas a tener siempre en el menú del bien, debajo del nombre, por si se suma alguien más.
          </p>
          <button type="button" className="btn btn--block bienes-ok__ir" onClick={() => onIr(creado)}>
            Ir al calendario
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate>
          <h2 id={`${id}-t`} className="bienes-modal__t">
            Nuevo bien compartido
          </h2>
          <p className="bienes-modal__s">
            Ponele un nombre que el grupo reconozca. Después te damos un código para que se sumen.
          </p>
          <label htmlFor={`${id}-nombre`} className="bienes-lbl">
            Nombre del bien
          </label>
          <input
            id={`${id}-nombre`}
            className="in bienes-in"
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
              {enviando ? 'Creando…' : 'Crear bien'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}

export default NewAssetModal
