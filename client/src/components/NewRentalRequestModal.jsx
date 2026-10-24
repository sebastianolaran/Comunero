import { useId, useState } from 'react'
import { CAMPO_DEL_SERVER, hoyLocal, montoSugerido, validarSolicitud } from '../lib/rentalRequests'
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'

// Como en el prototipo, las fechas arrancan en hoy.
const vacio = (hoy) => ({ nombre: '', apellido: '', telefono: '', desde: hoy, hasta: hoy, monto: '', comentarios: '' })

function Campo({ id, label, error, className = '', children }) {
  return (
    <div className={`campo ${className}`}>
      <label htmlFor={id} className="lbl">
        {label}
      </label>
      {children}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  )
}

// onCreate(solicitud) tiene que tirar un Error (con .field si es de un campo) si el alta falla.
// inicial: campos precargados (ej. nombre y teléfono desde el historial de inquilinos).
// precioPorDia: el de Configuración. Mientras no se escriba el monto a mano, se
// muestra días × precio; escribirlo corta esa cuenta.
function NewRentalRequestModal({ abierto, inicial, precioPorDia = null, onClose, onCreate }) {
  const [borrador, setBorrador] = useState(() => ({ ...vacio(hoyLocal()), ...inicial }))
  const [errores, setErrores] = useState({})
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  const [montoTocado, setMontoTocado] = useState(false)
  const id = useId()

  function limpiar() {
    setBorrador({ ...vacio(hoyLocal()), ...inicial })
    setMontoTocado(false)
    setErrores({})
    setEnvio({ enviando: false, error: null })
  }

  const sugerido = montoTocado ? null : montoSugerido(borrador.desde, borrador.hasta, precioPorDia)
  const monto = sugerido ? sugerido.texto : borrador.monto

  const cambiar = (campo) => (e) => {
    const valor = e.target.value
    if (campo === 'monto') setMontoTocado(true)
    setBorrador((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: undefined }))
  }

  async function enviar(e) {
    e.preventDefault()
    const validacion = validarSolicitud({ ...borrador, monto })
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
    <Modal abierto={abierto} titulo="Nueva solicitud de alquiler" onAbrir={limpiar} onClose={onClose}>
      <form onSubmit={enviar} noValidate>

        <div className="alq-fila">
          <Campo id={`${id}-nombre`} label="Nombre" error={errores.nombre}>
            <input className="in" placeholder="Ej: Javier" autoComplete="off" {...input('nombre')} />
          </Campo>
          <Campo id={`${id}-apellido`} label="Apellido" error={errores.apellido}>
            <input className="in" placeholder="Ej: Peralta" autoComplete="off" {...input('apellido')} />
          </Campo>
        </div>

        <Campo id={`${id}-telefono`} label="Teléfono (clave de identificación)" error={errores.telefono}>
          <input
            className="in"
            type="tel"
            inputMode="tel"
            placeholder="Ej: 11 5512-8890"
            autoComplete="off"
            {...input('telefono')}
          />
        </Campo>

        <div className="alq-fila">
          <Campo id={`${id}-desde`} label="Desde" error={errores.desde}>
            <input className="in" type="date" min={hoyLocal()} {...input('desde')} />
          </Campo>
          <Campo id={`${id}-hasta`} label="Hasta" error={errores.hasta}>
            <input className="in" type="date" min={borrador.desde || hoyLocal()} {...input('hasta')} />
          </Campo>
        </div>

        <Campo id={`${id}-monto`} label="Monto" error={errores.monto}>
          <input className="in" inputMode="numeric" placeholder="0" {...input('monto', { value: monto })} />
          {sugerido && !errores.monto && <p className="hint campo__ayuda">{sugerido.detalle}</p>}
        </Campo>

        <Campo id={`${id}-comentarios`} label="Comentarios" error={errores.comentarios}>
          <textarea
            className="ta"
            placeholder="Ej: 4 personas, ya alquilaron antes"
            {...input('comentarios')}
          />
        </Campo>

        <FieldError>{envio.error}</FieldError>

        <ModalAcciones>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={envio.enviando}>
            {envio.enviando ? 'Creando…' : 'Crear solicitud'}
          </button>
        </ModalAcciones>
      </form>
    </Modal>
  )
}

export default NewRentalRequestModal
