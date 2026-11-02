import { useState } from 'react'
import { DIAS_SEMANA, diasDelMes, mesAnterior, mesSiguiente, nombreMes, primerDiaSemana } from '../lib/calendar'
import { diaOcupado, rangoOcupado } from '../lib/listing'
import Icono from './Iconos'
import './CalendarioDisponibilidad.css'

const MESES_VISIBLES = 2
const MESES_HACIA_ADELANTE = 11

const iso = (fecha) => fecha.toISOString().slice(0, 10)
const etiqueta = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

function Mes({ year, month, hoy, ocupados, desde, hasta, onDia }) {
  const vacios = primerDiaSemana(year, month)
  return (
    <div className="cd-mes">
      <p className="cd-mes__t">{nombreMes(year, month)}</p>
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
      <div className="cd__meses">
        {meses.map((m) => (
          <Mes key={`${m.year}-${m.month}`} {...m} hoy={hoy} ocupados={ocupados} desde={desde} hasta={hasta} onDia={tocar} />
        ))}
      </div>
      <p className="cd__leyenda">
        <span className="cd__muestra cd__muestra--ocupado" aria-hidden="true" /> Ocupado
        <span className="cd__muestra cd__muestra--elegido" aria-hidden="true" /> Elegido
        <span className="cd__ayuda">Tocar la llegada y después la salida.</span>
      </p>
    </div>
  )
}

export default CalendarioDisponibilidad
