import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { leerNumero, porcentajeIgual, sumaPorcentajes, textoCambio, textoFechaCambio } from '../lib/settings'
import { fetchSettings, updateSettings } from '../services/settings'
import './Configuracion.css'

const color = (hue) => `oklch(56% 0.12 ${hue})`

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
    'Nadie puede pedir un turno de uso propio más largo que esto. No aplica a los alquileres a terceros. Vacío, sin límite.',
  responseHours:
    'Si una reserva de uso propio o una solicitud de alquiler sigue sin el voto de todos pasado este tiempo desde que se pidió, se rechaza sola. Vacío, queda pendiente hasta que voten todos.',
  noResponse:
    'Qué pasa con quien no votó cuando vence el tiempo para responder. Rechazado: la reserva se rechaza sola. Aprobado: su silencio cuenta como un Sí, así que se aprueba si nadie votó que no. Solo aplica si hay un tiempo máximo cargado.',
}

// Botón "i" con la explicación: se abre al pasar el mouse, con foco o con un
// toque (mobile), y se cierra al salir, al tocar afuera o con Escape. El click
// no alterna: el foco ya la abrió y alternar la cerraría en el mismo toque. El
// texto queda siempre en el DOM para que aria-describedby lo lea cerrado.
const MARGEN_PANTALLA = 16

function Ayuda({ texto }) {
  const id = useId()
  const [abierta, setAbierta] = useState(false)
  const pop = useRef(null)

  // En pantallas angostas el globo se saldría por la derecha: se corre lo justo.
  useLayoutEffect(() => {
    const el = pop.current
    if (!abierta || !el) return
    el.style.translate = ''
    const sobra = el.getBoundingClientRect().right - (window.innerWidth - MARGEN_PANTALLA)
    if (sobra > 0) el.style.translate = `${-sobra}px 0`
  }, [abierta])

  return (
    <span className="cfg__ayuda" onMouseEnter={() => setAbierta(true)} onMouseLeave={() => setAbierta(false)}>
      <button
        type="button"
        className="idot"
        aria-label="Qué hace"
        aria-describedby={id}
        aria-expanded={abierta}
        onClick={() => setAbierta(true)}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
        onKeyDown={(e) => e.key === 'Escape' && setAbierta(false)}
      >
        i
      </button>
      <span ref={pop} id={id} role="tooltip" className="pop cfg__pop" hidden={!abierta}>
        {texto}
      </span>
    </span>
  )
}

function Panel({ titulo, ayuda, hint, children, pie }) {
  const id = useId()
  return (
    <section className="panel cfg__p" aria-labelledby={id}>
      <div className="cfg__head">
        <div className="cfg__titulo">
          <h2 id={id} className="sect">
            {titulo}
          </h2>
          {ayuda && <Ayuda texto={ayuda} />}
        </div>
        {hint && <p className="hint">{hint}</p>}
      </div>
      {children}
      {pie}
    </section>
  )
}

// Guardar solo se activa con cambios sin guardar, y "Guardado" se ve mientras
// lo que está en pantalla es lo guardado: editar de nuevo lo saca.
function Pie({ estado, onGuardar, sinCambios, children }) {
  return (
    <div className="cfg__pie">
      {estado.error && (
        <p className="cfg__error" role="alert">
          {estado.error}
        </p>
      )}
      {!estado.error && estado.guardado && sinCambios && (
        <p className="cfg__estado" role="status">
          Guardado
        </p>
      )}
      {children}
      <button
        type="button"
        className="btn btn--sm btn--primary"
        disabled={estado.guardando || sinCambios}
        onClick={onGuardar}
      >
        {estado.guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}

function CampoNumero({ label, ayuda, unidad, value, onChange, placeholder = 'Sin límite' }) {
  const id = useId()
  return (
    <div className="cfg__row">
      <div className="cfg__lbl">
        <label htmlFor={id}>{label}</label>
        <Ayuda texto={ayuda} />
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
  rentalDailyRate: 'Costo por día',
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

  function volverAIguales() {
    setBorrador(Object.fromEntries(members.map((m) => [m.id, ''])))
    estado.guardar({ percents: null })
  }

  function guardar() {
    if (vacio) return estado.guardar({ percents: null })
    if (Object.values(borrador).some((v) => !/^\d+$/.test(v.trim()))) {
      return estado.fallar('Completá el porcentaje de todos con números enteros.')
    }
    if (suma !== 100) return estado.fallar(`Los porcentajes tienen que sumar 100 (suman ${suma}).`)
    estado.guardar({ percents: Object.fromEntries(Object.entries(borrador).map(([id, v]) => [id, Number(v)])) })
  }

  return (
    <Panel
      titulo="Porcentaje de gastos"
      ayuda={AYUDAS.percents}
      hint="Cómo se reparten los gastos y los ingresos entre los integrantes. Vacío, en partes iguales."
      pie={
        <Pie estado={estado} onGuardar={guardar} sinCambios={sinCambios}>
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
              <span className="legend__d" style={{ background: color(m.hue) }} />
              {m.name}
            </label>
            <div className="cfg__ctl">
              <input
                id={`pct-${m.id}`}
                className="in in--num"
                inputMode="numeric"
                placeholder={porcentajeIgual(members.length)}
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
      hint="Usado para pre-completar el monto al crear una solicitud."
      pie={<Pie estado={estado} onGuardar={guardar} sinCambios={sinCambios} />}
    >
      <CampoNumero
        label="Costo de alquilar un día"
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
            <Ayuda texto={AYUDAS.noResponse} />
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
  const nombres = Object.fromEntries(settings.members.map((m) => [m.id, m.name]))
  const lineas = settings.changes.flatMap((registro) =>
    registro.changes.map((cambio) => ({ registro, cambio })),
  )
  return (
    <Panel titulo="Cambios recientes" hint="Cualquier integrante puede cambiar la configuración; queda registrado acá.">
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

  if (carga.estado === 'loading') {
    return (
      <p className="empty" role="status">
        Cargando configuración…
      </p>
    )
  }
  if (carga.estado === 'error') {
    return (
      <div className="note" role="alert">
        <p>{carga.error}</p>
        <p>Si el backend estuvo inactivo, el primer pedido puede tardar hasta un minuto.</p>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            setCarga({ estado: 'loading', settings: null })
            setIntento((n) => n + 1)
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  const { settings } = carga
  const onGuardado = (nuevos) => setCarga({ estado: 'ok', settings: nuevos })

  return (
    <div className="cfg">
      <div className="cfg__col">
        <PanelPorcentajes settings={settings} onGuardado={onGuardado} />
        <PanelAlquiler settings={settings} onGuardado={onGuardado} />
      </div>
      <div className="cfg__col">
        <PanelReglas settings={settings} onGuardado={onGuardado} />
        <PanelCambios settings={settings} />
      </div>
    </div>
  )
}

export default Configuracion
