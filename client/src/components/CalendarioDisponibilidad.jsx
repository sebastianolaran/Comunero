import { useRef, useState } from 'react'
import { DIAS_SEMANA, diasDelMes, mesAnterior, mesSiguiente, nombreMes, primerDiaSemana } from '../lib/calendar'
import { diaOcupado, rangoOcupado } from '../lib/listing'
import Icono from './Iconos'
import './CalendarioDisponibilidad.css'

const MESES_VISIBLES = 2
const MESES_HACIA_ADELANTE = 11

const iso = (fecha) => fecha.toISOString().slice(0, 10)
const etiqueta = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const nombreDia = (dia) => etiqueta.format(new Date(`${dia}T00:00:00Z`))
const sumarDias = (dia, n) => iso(new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000))
// Flechas: un día o una semana. Inicio/Fin: a los extremos de la semana.
const PASOS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

function textoEleccion(desde, hasta) {
  if (desde && hasta) return `Llegada: ${nombreDia(desde)}. Salida: ${nombreDia(hasta)}.`
  if (desde) return `Llegada: ${nombreDia(desde)}. Falta elegir la salida.`
  return ''
}

function Mes({ year, month, hoy, ocupados, desde, hasta, foco, onDia }) {
  const vacios = primerDiaSemana(year, month)
  return (
    <div className="cd-mes">
      <h3 className="cd-mes__t">{nombreMes(year, month)}</h3>
      <div className="cd-grilla" role="group" aria-label={nombreMes(year, month)}>
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="cd-dow" aria-hidden="true">
            {d.slice(0, 2)}
          </span>
        ))}
        {Array.from({ length: vacios }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {diasDelMes(year, month).map((fecha) => {
          const dia = iso(fecha)
          const pasado = dia < hoy
          const ocupado = diaOcupado(dia, ocupados)
          const extremo = dia === desde || dia === hasta
          const enRango = desde && hasta && dia > desde && dia < hasta
          const clases = [
            'cd-dia',
            pasado && 'cd-dia--pasado',
            ocupado && 'cd-dia--ocupado',
            enRango && 'cd-dia--rango',
            extremo && 'cd-dia--elegido',
          ].filter(Boolean)
          return (
            <button
              key={dia}
              type="button"
              className={clases.join(' ')}
              disabled={pasado || ocupado}
              aria-pressed={extremo || enRango ? true : undefined}
              data-dia={dia}
              tabIndex={dia === foco ? 0 : -1}
              aria-label={`${etiqueta.format(fecha)}${ocupado ? ', ocupado' : ''}`}
              onClick={() => onDia(dia)}
            >
              {fecha.getUTCDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Primer toque: llegada. Segundo: salida (si es posterior y no cruza días
// ocupados; si no, ese día pasa a ser la nueva llegada).
function CalendarioDisponibilidad({ ocupados, hoy, desde, hasta, onElegir }) {
  const [anio, mes] = hoy.split('-').map(Number)
  const [inicio, setInicio] = useState({ year: anio, month: mes })
  const limite = Array.from({ length: MESES_HACIA_ADELANTE - MESES_VISIBLES + 1 }).reduce(
    (m) => mesSiguiente(m.year, m.month),
    { year: anio, month: mes },
  )
  const enPrimero = inicio.year === anio && inicio.month === mes
  const enUltimo = inicio.year === limite.year && inicio.month === limite.month
  const meses = [inicio, mesSiguiente(inicio.year, inicio.month)]
  const grilla = useRef(null)
  // Un solo día entra en el orden de Tab (el elegido o el primero libre); el
  // resto se recorre con las flechas, como una grilla.
  const [enfocado, setEnfocado] = useState(null)
  const diasVisibles = meses.flatMap((m) => diasDelMes(m.year, m.month).map(iso))
  const elegible = (dia) => dia >= hoy && !diaOcupado(dia, ocupados) && diasVisibles.includes(dia)
  const foco = [enfocado, desde, hasta].find((d) => d && elegible(d)) ?? diasVisibles.find(elegible)

  function mover(e) {
    const dia = e.target.dataset?.dia
    const paso = PASOS[e.key]
    if (!dia || !paso) return
    e.preventDefault()
    // Salta los días que no se pueden elegir, sin salir de los meses visibles.
    for (let n = 1, destino = sumarDias(dia, paso); n <= 62; n++, destino = sumarDias(destino, paso)) {
      if (!grilla.current?.querySelector(`[data-dia="${destino}"]`)) return
      const boton = elegible(destino) && grilla.current.querySelector(`[data-dia="${destino}"]`)
      if (boton) {
        setEnfocado(destino)
        return boton.focus()
      }
    }
  }

  function tocar(dia) {
    if (desde && !hasta && dia > desde && !rangoOcupado(desde, dia, ocupados)) {
      return onElegir({ startDate: desde, endDate: dia })
    }
    onElegir({ startDate: dia, endDate: '' })
  }

  return (
    <div className="cd">
      <div className="cd__nav">
        <button
          type="button"
          className="cd__flecha"
          aria-label="Meses anteriores"
          disabled={enPrimero}
          onClick={() => setInicio(mesAnterior(inicio.year, inicio.month))}
        >
          <Icono nombre="atras" className="fp-i" />
        </button>
        <button
          type="button"
          className="cd__flecha"
          aria-label="Meses siguientes"
          disabled={enUltimo}
          onClick={() => setInicio(mesSiguiente(inicio.year, inicio.month))}
        >
          <Icono nombre="siguiente" className="fp-i" />
        </button>
      </div>
      <div className="cd__meses" ref={grilla} onKeyDown={mover}>
        {meses.map((m) => (
          <Mes
            key={`${m.year}-${m.month}`}
            {...m}
            hoy={hoy}
            ocupados={ocupados}
            desde={desde}
            hasta={hasta}
            foco={foco}
            onDia={(dia) => {
              setEnfocado(dia)
              tocar(dia)
            }}
          />
        ))}
      </div>
      <p className="solo-lector" aria-live="polite">
        {textoEleccion(desde, hasta)}
      </p>
      <div className="cd__leyenda">
        <span className="cd__muestra cd__muestra--ocupado" aria-hidden="true">
          8
        </span>
        Ocupado
        <span className="cd__muestra cd__muestra--elegido" aria-hidden="true" />
        Elegido
        <span className="cd__ayuda">
          {desde && !hasta ? 'Falta tocar la salida.' : 'Tocar la llegada y después la salida.'}
          {desde && (
            <button type="button" className="btn btn--link btn--sm cd__borrar" onClick={() => onElegir({ startDate: '', endDate: '' })}>
              Borrar fechas
            </button>
          )}
        </span>
      </div>
    </div>
  )
}

export default CalendarioDisponibilidad
