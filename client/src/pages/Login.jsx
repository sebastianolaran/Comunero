import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { login } from '../lib/api'
import { DIAS_SEMANA, nombreMes } from '../lib/calendar'
import { LEYENDA_DEL_PANEL, celdasDelPanel, validarLogin } from '../lib/login'
import { guardarSesion } from '../lib/session'
import './Login.css'

function PanelDelMes() {
  const { year, month } = useMemo(() => {
    const hoy = new Date()
    return { year: hoy.getUTCFullYear(), month: hoy.getUTCMonth() + 1 }
  }, [])

  const celdas = useMemo(() => celdasDelPanel(year, month), [year, month])

  return (
    <aside className="login__panel" aria-hidden="true">
      <div className="login__mes">
        <div className="login__mes-t">{nombreMes(year, month)}</div>
        <div className="login__grid">
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="login__wd">
              {dia}
            </div>
          ))}
          {celdas.map((celda, i) => (
            <div
              key={i}
              className={[
                'login__d',
                celda.dia === null && 'login__d--out',
                celda.color && 'login__d--on',
                celda.pendiente && 'login__d--pend',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                celda.color
                  ? { background: celda.color, animationDelay: `${150 + celda.dia * 28}ms` }
                  : undefined
              }
            >
              {celda.dia}
            </div>
          ))}
        </div>
        <div className="login__legend">
          {LEYENDA_DEL_PANEL.map(({ label, color }) => (
            <span key={label} className="login__legend-i">
              <span className="login__legend-d" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <p className="login__p">
        Los días de cada uno, los alquileres y los gastos del bien, a la vista de todo el grupo.
      </p>
    </aside>
  )
}

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPass, setVerPass] = useState(false)
  const [errores, setErrores] = useState({})
  const [alerta, setAlerta] = useState('')
  const [entrando, setEntrando] = useState(false)

  async function onSubmit(ev) {
    ev.preventDefault()

    const encontrados = validarLogin({ email, password })
    if (encontrados.email || encontrados.pass) {
      setErrores(encontrados)
      setAlerta('')
      return
    }

    setErrores({})
    setAlerta('')
    setEntrando(true)
    try {
      const usuario = await login({ email: email.trim(), password })
      guardarSesion(usuario)
      navigate('/', { replace: true })
    } catch (err) {
      // api.login ya se encarga de que el mensaje sea presentable, tanto el
      // del 401 como el de "no se pudo llegar al server".
      setAlerta(err.message)
    } finally {
      setEntrando(false)
    }
  }

  const eyeLabel = verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'

  return (
    <div className="login">
      <main className="login__side">
        <div className="login__marca">Comunero</div>

        <form className="login__form" onSubmit={onSubmit} noValidate>
          <h1 className="login__t">Ingresá a tu cuenta</h1>
          <p className="login__s">Con el mail y la contraseña con los que te sumaron al grupo.</p>

          {alerta && (
            <p className="login__alert" role="alert">
              {alerta}
            </p>
          )}

          <div className="login__f">
            <label className="login__lbl" htmlFor="login-email">
              Mail
            </label>
            <input
              id="login-email"
              className={`login__in${errores.email ? ' login__in--err' : ''}`}
              type="email"
              autoComplete="email"
              placeholder="nombre@ejemplo.com"
              value={email}
              onChange={(ev) => {
                setEmail(ev.target.value)
                setErrores((previos) => ({ ...previos, email: '' }))
              }}
            />
            {errores.email && <p className="login__err">{errores.email}</p>}
          </div>

          <div className="login__f">
            <label className="login__lbl" htmlFor="login-pass">
              Contraseña
            </label>
            <span className="login__pass">
              <input
                id="login-pass"
                className={`login__in${errores.pass ? ' login__in--err' : ''}`}
                type={verPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(ev) => {
                  setPassword(ev.target.value)
                  setErrores((previos) => ({ ...previos, pass: '' }))
                }}
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
            {errores.pass && <p className="login__err">{errores.pass}</p>}
          </div>

          <button type="submit" className="login__go" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Ingresar'}
          </button>
        </form>

        <p className="login__foot">
          ¿Todavía no tenés cuenta? Pedile a alguien del grupo que te sume.
        </p>
      </main>

      <PanelDelMes />
    </div>
  )
}

export default Login
