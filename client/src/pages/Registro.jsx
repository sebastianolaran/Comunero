import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { registrarse } from '../lib/api'
import { validarRegistro } from '../lib/registro'
import { guardarSesion } from '../lib/session'
import { PanelDelMes } from './Login'
import './Login.css'

const CAMPOS = [
  { id: 'nombre', label: 'Nombre', type: 'text', autoComplete: 'name' },
  { id: 'email', label: 'Mail', type: 'email', autoComplete: 'email', placeholder: 'nombre@ejemplo.com' },
  { id: 'telefono', label: 'Teléfono', type: 'tel', autoComplete: 'tel', placeholder: '+54 9 11 2233-4455' },
]

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
      if (Object.keys(err.campos ?? {}).length > 0) setErrores(err.campos)
      else setAlerta(err.message)
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
          <h1 className="login__t">Creá tu cuenta</h1>
          <p className="login__s">Después vas a poder crear un bien o sumarte a uno con un código.</p>

          {alerta && (
            <p className="login__alert" role="alert">
              {alerta}
            </p>
          )}

          {CAMPOS.map(({ id, label, ...input }) => (
            <div key={id} className="login__f">
              <label className="login__lbl" htmlFor={`registro-${id}`}>
                {label}
              </label>
              <input
                id={`registro-${id}`}
                className={`login__in${errores[id] ? ' login__in--err' : ''}`}
                value={valores[id]}
                aria-invalid={Boolean(errores[id])}
                aria-describedby={errores[id] ? `registro-${id}-err` : undefined}
                onChange={(ev) => cambiar(id, ev.target.value)}
                {...input}
              />
              {errores[id] && (
                <p id={`registro-${id}-err`} className="login__err">
                  {errores[id]}
                </p>
              )}
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
                placeholder="8 caracteres como mínimo"
                value={valores.password}
                aria-invalid={Boolean(errores.password)}
                aria-describedby={errores.password ? 'registro-password-err' : undefined}
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
            {errores.password && (
              <p id="registro-password-err" className="login__err">
                {errores.password}
              </p>
            )}
          </div>

          <button type="submit" className="login__go" disabled={creando}>
            {creando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="login__foot">
          ¿Ya tenés cuenta?{' '}
          <Link className="login__link" to="/login">
            Ingresá
          </Link>
        </p>
      </main>

      <PanelDelMes />
    </div>
  )
}

export default Registro
