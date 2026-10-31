import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { registrarse } from '../lib/api'
import { validarRegistro } from '../lib/registro'
import { guardarSesion } from '../lib/session'
import { PanelDelMes } from './Login'
import FieldError from '../components/ui/FieldError'
import './Login.css'

const CAMPOS = [
  { id: 'nombre', label: 'Nombre', type: 'text', autoComplete: 'name' },
  { id: 'email', label: 'Mail', type: 'email', autoComplete: 'email', placeholder: 'nombre@ejemplo.com' },
  {
    id: 'telefono',
    label: 'Teléfono',
    type: 'tel',
    autoComplete: 'tel',
    placeholder: '+54 9 11 2233-4455',
    ayuda: 'Identifica la cuenta, como el mail. No se muestra al resto del grupo.',
  },
]

// Orden en que se recorren los campos para enfocar el primero con error.
const ORDEN = ['nombre', 'email', 'telefono', 'password']

function enfocarPrimerError(errores) {
  const campo = ORDEN.find((id) => errores[id])
  if (campo) document.getElementById(`registro-${campo}`)?.focus()
}

function describedBy(...ids) {
  const presentes = ids.filter(Boolean)
  return presentes.length > 0 ? presentes.join(' ') : undefined
}

function Registro() {
  const navigate = useNavigate()
  // Lo escrito no se borra nunca: si algo falla, queda cargado para corregir.
  const [valores, setValores] = useState({ nombre: '', email: '', telefono: '', password: '' })
  const [verPass, setVerPass] = useState(false)
  const [errores, setErrores] = useState({})
  const [alerta, setAlerta] = useState('')
  const [creando, setCreando] = useState(false)

  function cambiar(campo, valor) {
    setValores((previos) => ({ ...previos, [campo]: valor }))
    setErrores((previos) => ({ ...previos, [campo]: '' }))
  }

  async function onSubmit(ev) {
    ev.preventDefault()

    const encontrados = validarRegistro(valores)
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados)
      setAlerta('')
      enfocarPrimerError(encontrados)
      return
    }

    setErrores({})
    setAlerta('')
    setCreando(true)
    try {
      const usuario = await registrarse({ ...valores, email: valores.email.trim() })
      // La misma sesión que deja el login: entra directo a sus bienes.
      guardarSesion(usuario)
      navigate('/bienes', { replace: true })
    } catch (err) {
      // Si el server marcó campos (mail ya registrado, etc.) van debajo de
      // cada uno; si no, es un problema general (red, 500).
      if (Object.keys(err.campos ?? {}).length > 0) {
        setErrores(err.campos)
        enfocarPrimerError(err.campos)
      } else setAlerta(err.message)
    } finally {
      setCreando(false)
    }
  }

  const eyeLabel = verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'

  return (
    <div className="login">
      <main className="login__side">
        <div className="login__marca">Comunero</div>

        <form className="login__form" onSubmit={onSubmit} noValidate>
          <h1 className="login__t">Crear una cuenta</h1>
          <p className="login__s">Después se puede crear un bien o unirse a uno con un código.</p>

          {alerta && (
            <p className="login__alert" role="alert">
              {alerta}
            </p>
          )}

          {CAMPOS.map(({ id, label, ayuda, ...input }) => (
            <div key={id} className="login__f">
              <label className="login__lbl" htmlFor={`registro-${id}`}>
                {label}
              </label>
              <input
                id={`registro-${id}`}
                className={`login__in${errores[id] ? ' login__in--err' : ''}`}
                value={valores[id]}
                aria-invalid={errores[id] ? true : undefined}
                aria-describedby={describedBy(ayuda && `registro-${id}-ayuda`, errores[id] && `registro-${id}-err`)}
                onChange={(ev) => cambiar(id, ev.target.value)}
                {...input}
              />
              {ayuda && (
                <p id={`registro-${id}-ayuda`} className="login__ayuda">
                  {ayuda}
                </p>
              )}
              <FieldError id={`registro-${id}-err`}>{errores[id]}</FieldError>
            </div>
          ))}

          <div className="login__f">
            <label className="login__lbl" htmlFor="registro-password">
              Contraseña
            </label>
            <span className="login__pass">
              <input
                id="registro-password"
                className={`login__in${errores.password ? ' login__in--err' : ''}`}
                type={verPass ? 'text' : 'password'}
                autoComplete="new-password"
                value={valores.password}
                aria-invalid={errores.password ? true : undefined}
                aria-describedby={describedBy('registro-password-ayuda', errores.password && 'registro-password-err')}
                onChange={(ev) => cambiar('password', ev.target.value)}
              />
              <button
                type="button"
                className="login__eye"
                onClick={() => setVerPass((visible) => !visible)}
                title={eyeLabel}
                aria-label={eyeLabel}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {verPass && <path d="M4 4l16 16" />}
                </svg>
              </button>
            </span>
            <p id="registro-password-ayuda" className="login__ayuda">
              8 caracteres como mínimo.
            </p>
            <FieldError id="registro-password-err">{errores.password}</FieldError>
          </div>

          <button type="submit" className="login__go" disabled={creando}>
            {creando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="login__foot">
          ¿Ya hay una cuenta?{' '}
          <Link className="login__link" to="/login">
            Ingresar
          </Link>
        </p>
      </main>

      <PanelDelMes />
    </div>
  )
}

export default Registro
