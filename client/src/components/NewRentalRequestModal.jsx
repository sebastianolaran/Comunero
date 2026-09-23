import { useEffect, useId, useRef, useState } from 'react'
import { CAMPO_DEL_SERVER, hoyLocal, validarSolicitud } from '../lib/rentalRequests'

// Como en el prototipo, las fechas arrancan en hoy.
const vacio = (hoy) => ({ nombre: '', apellido: '', telefono: '', desde: hoy, hasta: hoy, monto: '', comentarios: '' })

function Campo({ id, label, error, className = '', children }) {
  return (
    <div className={`nueva-campo ${className}`}>
      <label htmlFor={id} className="nueva-label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="nueva-error">
          {error}
        </p>
      )}
    </div>
  )
}

// onCreate(solicitud) tiene que tirar un Error (con .field si es de un campo) si el alta falla.
// inicial: campos precargados (ej. nombre y teléfono desde el historial de inquilinos).
function NewRentalRequestModal({ abierto, inicial, onClose, onCreate }) {
  const dialogo = useRef(null)
  const [borrador, setBorrador] = useState(() => ({ ...vacio(hoyLocal()), ...inicial }))
  const [errores, setErrores] = useState({})
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  const id = useId()
  const idTitulo = `${id}-titulo`

  useEffect(() => {
    const d = dialogo.current
    if (abierto && !d.open) {
      setBorrador({ ...vacio(hoyLocal()), ...inicial })
      setErrores({})
      setEnvio({ enviando: false, error: null })
      d.showModal()
    }
    if (!abierto && d.open) d.close()
  }, [abierto, inicial])

  const cambiar = (campo) => (e) => {
    const valor = e.target.value
    setBorrador((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: undefined }))
  }

  async function enviar(e) {
    e.preventDefault()
    const validacion = validarSolicitud(borrador)
    if (validacion.errores) {
      setErrores(validacion.errores)
      return
    }
    setEnvio({ enviando: true, error: null })
    try {
      await onCreate(validacion.solicitud)
    } catch (err) {
      const campo = CAMPO_DEL_SERVER[err.field]
      if (campo) setErrores({ [campo]: err.message })
      setEnvio({ enviando: false, error: campo ? null : err.message })
    }
  }

  const input = (campo, props = {}) => ({
    id: `${id}-${campo}`,
    name: campo,
    value: borrador[campo],
    onChange: cambiar(campo),
    'aria-invalid': errores[campo] ? true : undefined,
    'aria-describedby': errores[campo] ? `${id}-${campo}-error` : undefined,
    ...props,
  })

  return (
    <dialog
      ref={dialogo}
      className="nueva-dialogo"
      aria-labelledby={idTitulo}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogo.current) onClose()
      }}
    >
      <form className="nueva-form" onSubmit={enviar} noValidate>
        <h2 id={idTitulo} className="nueva-titulo">
          Nueva solicitud de alquiler
        </h2>

        <div className="nueva-fila">
          <Campo id={`${id}-nombre`} label="Nombre" error={errores.nombre}>
            <input className="nueva-input" placeholder="Ej: Javier" autoComplete="off" {...input('nombre')} />
          </Campo>
          <Campo id={`${id}-apellido`} label="Apellido" error={errores.apellido}>
            <input className="nueva-input" placeholder="Ej: Peralta" autoComplete="off" {...input('apellido')} />
          </Campo>
        </div>

        <Campo id={`${id}-telefono`} label="Teléfono (clave de identificación)" error={errores.telefono}>
          <input
            className="nueva-input"
            type="tel"
            inputMode="tel"
            placeholder="Ej: 11 5512-8890"
            autoComplete="off"
            {...input('telefono')}
          />
        </Campo>

        <div className="nueva-fila">
          <Campo id={`${id}-desde`} label="Desde" error={errores.desde} className="is-fecha">
            <input className="nueva-input" type="date" min={hoyLocal()} {...input('desde')} />
          </Campo>
          <Campo id={`${id}-hasta`} label="Hasta" error={errores.hasta} className="is-fecha">
            <input className="nueva-input" type="date" min={borrador.desde || hoyLocal()} {...input('hasta')} />
          </Campo>
        </div>

        <Campo id={`${id}-monto`} label="Monto" error={errores.monto}>
          <input className="nueva-input" inputMode="numeric" placeholder="0" {...input('monto')} />
        </Campo>

        <Campo id={`${id}-comentarios`} label="Comentarios" error={errores.comentarios}>
          <textarea
            className="nueva-input nueva-comentarios"
            placeholder="Ej: 4 personas, ya alquilaron antes"
            {...input('comentarios')}
          />
        </Campo>

        {envio.error && (
          <p className="nueva-error is-general" role="alert">
            {envio.error}
          </p>
        )}

        <div className="detalle-acciones">
          <button type="button" className="detalle-boton nueva-cancelar" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="detalle-boton is-primario" disabled={envio.enviando}>
            {envio.enviando ? 'Creando…' : 'Crear solicitud'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default NewRentalRequestModal
