import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { Ayuda, Panel, Pie } from '../components/ConfigPanel'
import ConfirmDialog from '../components/ConfirmDialog'
import { Cargando, ErrorCarga } from '../components/ui/Estado'
import PanelFicha from '../components/PanelFicha'
import { assetIdActual, assetNameActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { soltarBien } from '../lib/session'
import {
  leerNumero,
  nombresDelRegistro,
  porcentajeIgual,
  sumaPorcentajes,
  textoCambio,
  textoFechaCambio,
  textoSaldosAlSalir,
} from '../lib/settings'
import { fetchBalances } from '../services/balance'
import { fetchSettings, leaveAsset, updateSettings } from '../services/settings'
import { colorDeIntegrante } from '../lib/calendar'
import './Configuracion.css'


// Guardar de un panel: { guardando, error, guardado } y la función que manda los cambios.
function useGuardar(onGuardado) {
  const [estado, setEstado] = useState({ guardando: false, error: null, guardado: false })

  async function guardar(cambios) {
    setEstado({ guardando: true, error: null, guardado: false })
    try {
      const settings = await updateSettings(assetIdActual(), userIdActual(), cambios)
      setEstado({ guardando: false, error: null, guardado: true })
      onGuardado(settings)
    } catch (err) {
      setEstado({ guardando: false, error: err.message, guardado: false })
    }
  }

  const fallar = (error) => setEstado({ guardando: false, error, guardado: false })
  return { ...estado, guardar, fallar }
}

// Qué efecto tiene cada configuración, en el orden de la pantalla.
const AYUDAS = {
  percents:
    'Define cuánto le toca a cada uno en los gastos e ingresos que se carguen de ahora en adelante; lo ya cargado no cambia. Si un gasto se divide solo entre algunos, se reparte en proporción a sus porcentajes. Vacío, en partes iguales.',
  rentalDailyRate:
    'Al cargar una solicitud de alquiler, el monto se completa solo con los días por este precio. Se puede cambiar en cada solicitud. Vacío, el monto se escribe a mano.',
  maxConsecutiveDays:
    'Nadie puede pedir una reserva de uso propio más larga que esto. No aplica a los alquileres a terceros. Vacío, sin límite.',
  responseHours:
    'Cuántas horas tienen los demás para votar un uso propio o una solicitud de alquiler, contadas desde que se pide. Si pasado ese tiempo falta algún voto, la votación se cierra sola como diga la opción de abajo. Vacío, no vence: espera a que voten todos. Las decisiones grupales no vencen nunca.',
  noResponse:
    'Cómo se cierra la votación cuando vence el tiempo y alguien no votó. Rechazado: se rechaza. Aprobado: quien no votó cuenta como un Sí; si alguien votó que no, se rechaza igual. Solo aplica si hay un tiempo máximo cargado.',
}

function CampoNumero({ label, ayuda, unidad, value, onChange, placeholder = 'Sin límite' }) {
  const id = useId()
  return (
    <div className="cfg__row">
      <div className="cfg__lbl">
        <label htmlFor={id}>{label}</label>
        <Ayuda texto={ayuda} sobre={label} />
      </div>
      <div className="cfg__ctl">
        <input
          id={id}
          className="in in--num"
          inputMode="numeric"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="meta">{unidad}</span>
      </div>
    </div>
  )
}

const texto = (valor) => (valor == null ? '' : String(valor))
// 70000 -> "70.000": el campo acepta los puntos al guardar.
const textoMonto = (valor) => texto(valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Para que el error diga cuál campo está mal: un panel tiene varios.
const ETIQUETAS = {
  rentalDailyRate: 'Precio por día',
  maxConsecutiveDays: 'Días consecutivos',
  responseHours: 'Tiempo para responder',
}

// Lee los campos y, si alguno no es un número válido, devuelve el error.
function leerCampos(borrador) {
  const cambios = {}
  for (const [campo, valor] of Object.entries(borrador)) {
    const leido = leerNumero(valor)
    if (leido.error) return { error: `${ETIQUETAS[campo]}: ${leido.error.toLowerCase()}` }
    cambios[campo] = leido.valor
  }
  return { cambios }
}

function PanelPorcentajes({ settings, onGuardado }) {
  const { members } = settings
  const iguales = members.every((m) => m.percent == null)
  const [borrador, setBorrador] = useState(() => Object.fromEntries(members.map((m) => [m.id, texto(m.percent)])))
  const estado = useGuardar(onGuardado)
  const sinCambios = members.every((m) => (borrador[m.id] ?? '').trim() === texto(m.percent))
  const vacio = Object.values(borrador).every((v) => v.trim() === '')
  const suma = sumaPorcentajes(borrador)
  // Con algún número escrito, el reparto ya no es en partes iguales: se avisa
  // en vivo qué falta y Guardar espera a que la suma dé 100.
  const incompleto = !vacio && Object.values(borrador).some((v) => !/^\d+$/.test(v.trim()))
  const problema = vacio
    ? null
    : incompleto
      ? 'Falta el porcentaje de alguien.'
      : suma < 100
        ? `Faltan ${100 - suma}% para llegar a 100.`
        : suma > 100
          ? `Sobran ${suma - 100}%: tienen que sumar 100.`
          : null

  function volverAIguales() {
    setBorrador(Object.fromEntries(members.map((m) => [m.id, ''])))
    estado.guardar({ percents: null })
  }

  function guardar() {
    if (vacio) return estado.guardar({ percents: null })
    if (Object.values(borrador).some((v) => !/^\d+$/.test(v.trim()))) {
      return estado.fallar('Falta el porcentaje de alguien: tienen que ser números enteros.')
    }
    if (suma !== 100) return estado.fallar(`Los porcentajes tienen que sumar 100 (suman ${suma}).`)
    estado.guardar({ percents: Object.fromEntries(Object.entries(borrador).map(([id, v]) => [id, Number(v)])) })
  }

  return (
    <Panel
      titulo="Porcentaje de gastos"
      ayuda={AYUDAS.percents}
      hint={
        vacio
          ? `Hoy en partes iguales: ${porcentajeIgual(members.length)}% cada uno (en gris). Escribir un número cambia el reparto.`
          : 'Cómo se reparten los gastos y los ingresos entre los integrantes. Vacío, en partes iguales.'
      }
      pie={
        <Pie estado={estado} onGuardar={guardar} sinCambios={sinCambios} bloqueado={Boolean(problema)}>
          {!iguales && (
            <button type="button" className="btn btn--sm" disabled={estado.guardando} onClick={volverAIguales}>
              Volver a partes iguales
            </button>
          )}
        </Pie>
      }
    >
      <div className="cfg__rows">
        {members.map((m) => (
          <div className="cfg__row" key={m.id}>
            <label className="cfg__lbl" htmlFor={`pct-${m.id}`}>
              <span className="legend__d" style={{ background: colorDeIntegrante(m.id, m.hue) }} />
              {m.name}
            </label>
            <div className="cfg__ctl">
              <input
                id={`pct-${m.id}`}
                className="in in--num"
                inputMode="numeric"
                placeholder={vacio ? porcentajeIgual(members.length) : '—'}
                value={borrador[m.id] ?? ''}
                onChange={(e) => setBorrador((prev) => ({ ...prev, [m.id]: e.target.value }))}
              />
              <span className="meta">%</span>
            </div>
          </div>
        ))}
        <div className="cfg__row cfg__row--total">
          <div className="cfg__lbl">Suma total</div>
          <div className="cfg__ctl">
            <span className={vacio || suma === 100 ? 'cfg__sum' : 'cfg__sum cfg__sum--mal'}>{vacio ? 100 : suma}</span>
            <span className="meta">%</span>
          </div>
        </div>
        {problema && (
          <p className="hint cfg__falta" aria-live="polite">
            {problema}
          </p>
        )}
      </div>
    </Panel>
  )
}

function PanelAlquiler({ settings, onGuardado }) {
  const [precio, setPrecio] = useState(textoMonto(settings.rentalDailyRate))
  const estado = useGuardar(onGuardado)
  const sinCambios = leerNumero(precio).valor === settings.rentalDailyRate

  function guardar() {
    const { cambios, error } = leerCampos({ rentalDailyRate: precio })
    if (error) return estado.fallar(error)
    estado.guardar(cambios)
  }

  return (
    <Panel
      titulo="Alquiler a terceros"
      hint="Con este precio se completa solo el monto de cada solicitud nueva."
      pie={<Pie estado={estado} onGuardar={guardar} sinCambios={sinCambios} />}
    >
      <CampoNumero
        label="Precio por día del alquiler"
        ayuda={AYUDAS.rentalDailyRate}
        unidad="$ / día"
        placeholder="Sin precio"
        value={precio}
        onChange={setPrecio}
      />
    </Panel>
  )
}

function PanelReglas({ settings, onGuardado }) {
  const [borrador, setBorrador] = useState({
    maxConsecutiveDays: texto(settings.maxConsecutiveDays),
    responseHours: texto(settings.responseHours),
  })
  const [noResponde, setNoResponde] = useState(settings.noResponseAction)
  const idNoResponde = useId()
  const estado = useGuardar(onGuardado)
  const cambiar = (campo) => (valor) => setBorrador((prev) => ({ ...prev, [campo]: valor }))
  const sinCambios =
    noResponde === settings.noResponseAction &&
    Object.entries(borrador).every(([campo, valor]) => leerNumero(valor).valor === settings[campo])

  function guardar() {
    const { cambios, error } = leerCampos(borrador)
    if (error) return estado.fallar(error)
    estado.guardar({ ...cambios, noResponseAction: noResponde })
  }

  return (
    <Panel
      titulo="Reglas de reserva"
      hint="A nivel de todos los integrantes. Vacío, sin límite."
      pie={<Pie estado={estado} onGuardar={guardar} sinCambios={sinCambios} />}
    >
      <div className="cfg__rows">
        <CampoNumero
          label="Máximo de días consecutivos por reserva"
          ayuda={AYUDAS.maxConsecutiveDays}
          unidad="días"
          value={borrador.maxConsecutiveDays}
          onChange={cambiar('maxConsecutiveDays')}
        />
        <CampoNumero
          label="Tiempo máximo para responder"
          ayuda={AYUDAS.responseHours}
          unidad="horas"
          value={borrador.responseHours}
          onChange={cambiar('responseHours')}
        />
        <div className="cfg__row">
          <div className="cfg__lbl">
            <label htmlFor={idNoResponde}>Si un integrante no responde a tiempo</label>
            <Ayuda texto={AYUDAS.noResponse} sobre="Si un integrante no responde a tiempo" />
          </div>
          <select
            id={idNoResponde}
            className="sel cfg__sel"
            value={noResponde}
            onChange={(e) => setNoResponde(e.target.value)}
          >
            <option value="REJECT">Se considera rechazado</option>
            <option value="APPROVE">Se considera aprobado</option>
          </select>
        </div>
      </div>
    </Panel>
  )
}

function PanelCambios({ settings }) {
  const nombres = nombresDelRegistro(settings.members, settings.changes, settings.formerNames)
  const lineas = settings.changes.flatMap((registro) =>
    registro.changes.map((cambio) => ({ registro, cambio })),
  )
  return (
    <Panel
      titulo="Cambios recientes"
      hint="Cualquier integrante puede cambiar la configuración y la ficha pública; queda registrado acá."
    >
      {lineas.length === 0 ? (
        <p className="empty">Todavía nadie cambió la configuración.</p>
      ) : (
        // Alto fijo con scroll propio: si no, la columna crece con cada cambio.
        <ul className="cfg__cambios" tabIndex={0} aria-label="Cambios recientes">
          {lineas.map(({ registro, cambio }) => (
            <li className="cfg__cambio" key={`${registro.id}-${cambio.field}`}>
              {textoCambio(cambio, nombres)}
              <span className="meta">
                {registro.user.name} · {textoFechaCambio(registro.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// Lo que pasa con los porcentajes, para avisarlo antes de confirmar.
function efectoEnPorcentajes(members, userId) {
  const mio = members.find((m) => m.id === userId)?.percent
  if (mio == null) return 'Los gastos se siguen repartiendo en partes iguales entre los que quedan.'
  if (mio === 0) return 'El porcentaje propio es 0%: el de los demás queda igual.'
  return 'Los porcentajes de gastos dejan de sumar 100 y vuelven a partes iguales entre los que quedan.'
}

function PanelSalir({ settings }) {
  const navigate = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const [estado, setEstado] = useState({ saliendo: false, error: null })
  const [avisoSaldos, setAvisoSaldos] = useState(null)
  const ultimo = settings.members.length === 1

  // Irse no salda nada: si hay deudas abiertas, la confirmación lo dice. Si el
  // balance no se puede traer, se confirma igual sin el aviso.
  async function pedirConfirmacion() {
    setEstado({ saliendo: false, error: null })
    setAvisoSaldos(null)
    setConfirmando(true)
    try {
      const { coowners } = await fetchBalances({ assetId: assetIdActual(), userId: userIdActual() })
      setAvisoSaldos(textoSaldosAlSalir(coowners))
    } catch {
      setAvisoSaldos(null)
    }
  }

  async function salir() {
    setEstado({ saliendo: true, error: null })
    try {
      await leaveAsset(assetIdActual(), userIdActual())
      soltarBien()
      navigate('/bienes', { replace: true })
    } catch (err) {
      setEstado({ saliendo: false, error: err.message })
    }
  }

  return (
    <Panel
      titulo="Salir del bien"
      hint={
        ultimo
          ? 'Único integrante: no es posible salir, el bien quedaría sin nadie.'
          : 'Se deja de ser copropietario. Lo ya cargado (movimientos, reservas pasadas) queda como está.'
      }
      pie={
        <div className="cfg__pie">
          <button
            type="button"
            className="btn btn--sm btn--danger"
            disabled={ultimo}
            onClick={pedirConfirmacion}
          >
            Salir del bien
          </button>
        </div>
      }
    >
      {confirmando && (
        <ConfirmDialog
          title={`¿Salir de ${assetNameActual() ?? 'este bien'}?`}
          lines={[
            ...(avisoSaldos ? [avisoSaldos] : []),
            efectoEnPorcentajes(settings.members, userIdActual()),
            'Para volver a entrar hace falta el código del bien.',
          ]}
          confirmLabel="Salir del bien"
          busyLabel="Saliendo…"
          busy={estado.saliendo}
          error={estado.error}
          onConfirm={salir}
          onCancel={() => setConfirmando(false)}
        />
      )}
    </Panel>
  )
}

function Configuracion() {
  const [carga, setCarga] = useState({ estado: 'loading', settings: null })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchSettings(assetIdActual(), userIdActual(), { signal: controller.signal })
      .then((settings) => setCarga({ estado: 'ok', settings }))
      .catch((err) => {
        if (err.name !== 'AbortError') setCarga({ estado: 'error', settings: null, error: err.message })
      })
    return () => controller.abort()
  }, [intento])

  // Un cambio en la ficha aparece en "Cambios recientes": se vuelve a traer sin
  // pasar por "Cargando". Si falla, queda lo que había.
  function refrescarCambios() {
    fetchSettings(assetIdActual(), userIdActual())
      .then((settings) => setCarga({ estado: 'ok', settings }))
      .catch(() => {})
  }

  if (carga.estado === 'loading') return <Cargando filas={4}>Cargando configuración…</Cargando>
  if (carga.estado === 'error') {
    return (
      <ErrorCarga
        titulo={carga.error}
        onReintentar={() => {
          setCarga({ estado: 'loading', settings: null })
          setIntento((n) => n + 1)
        }}
      />
    )
  }

  const { settings } = carga
  const onGuardado = (nuevos) => setCarga({ estado: 'ok', settings: nuevos })

  return (
    <div className="cfg">
      <div className="cfg__col">
        <PanelPorcentajes settings={settings} onGuardado={onGuardado} />
        <PanelAlquiler settings={settings} onGuardado={onGuardado} />
        <PanelFicha precioPorDia={settings.rentalDailyRate} onCambio={refrescarCambios} />
      </div>
      <div className="cfg__col">
        <PanelReglas settings={settings} onGuardado={onGuardado} />
        <PanelCambios settings={settings} />
        <PanelSalir settings={settings} />
      </div>
    </div>
  )
}

export default Configuracion
