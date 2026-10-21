const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Mismo tope que el server (asset.rules.js).
export const MAX_NOMBRE_BIEN = 60

// Mismas iniciales que el avatar de la barra superior (AppLayout).
export function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/)
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)
  return letras.charAt(0).toUpperCase() + letras.slice(1).toLowerCase()
}

export function textoIntegrantes(cantidad) {
  return cantidad === 1 ? '1 integrante' : `${cantidad} integrantes`
}

export function textoPendientes(cantidad) {
  if (!cantidad) return null
  return cantidad === 1 ? '1 pedido por votar' : `${cantidad} pedidos por votar`
}

// Se parsea a mano para que la zona horaria no corra el día.
function partes(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return { anio, mes, dia }
}

function dia(fecha, anioActual) {
  const { anio, mes, dia: d } = partes(fecha)
  return `${d} ${MESES[mes - 1]}${anio !== anioActual ? ` ${anio}` : ''}`
}

// "24 – 25 oct", "31 oct – 2 nov" o "24 oct" si es un solo día.
function rangoCorto(desde, hasta, anioActual) {
  if (desde === hasta) return dia(desde, anioActual)
  const a = partes(desde)
  const b = partes(hasta)
  if (a.anio === b.anio && a.mes === b.mes) return `${a.dia} – ${dia(hasta, anioActual)}`
  return `${dia(desde, anioActual)} – ${dia(hasta, anioActual)}`
}

// "del 31 oct al 2 nov", "del 24 al 26 oct" o "el 24 oct".
function rangoLargo(desde, hasta, anioActual) {
  if (desde === hasta) return `el ${dia(desde, anioActual)}`
  const a = partes(desde)
  const b = partes(hasta)
  if (a.anio === b.anio && a.mes === b.mes) return `del ${a.dia} al ${dia(hasta, anioActual)}`
  return `del ${dia(desde, anioActual)} al ${dia(hasta, anioActual)}`
}

export function textoEstadia(stay, hoy = new Date()) {
  const anio = hoy.getFullYear()
  switch (stay?.kind) {
    case 'MY_STAY':
      return `Tu próxima estadía: ${rangoCorto(stay.startDate, stay.endDate, anio)}`
    case 'RENTED':
      return `Alquilada ${rangoLargo(stay.startDate, stay.endDate, anio)}`
    case 'RESERVED':
      return `Reservada por ${stay.userName} ${rangoLargo(stay.startDate, stay.endDate, anio)}`
    default:
      return 'Libre esta semana'
  }
}

export function validarNombreBien(nombre) {
  const limpio = nombre.trim()
  if (!limpio) return { error: 'Ponele un nombre al bien.' }
  if (limpio.length > MAX_NOMBRE_BIEN) {
    return { error: `El nombre no puede superar los ${MAX_NOMBRE_BIEN} caracteres.` }
  }
  return { nombre: limpio }
}

const CODIGO = /^([A-Z]{3})-?([A-Z0-9]{4})$/

// Un código mal formado no se manda: no gasta intentos del límite.
export function validarCodigo(texto) {
  const limpio = texto.replace(/\s+/g, '').toUpperCase()
  if (!limpio) return { error: 'Ingresá el código que te pasaron.' }
  const partesCodigo = CODIGO.exec(limpio)
  if (!partesCodigo) {
    return { error: 'Revisá el código: son tres letras, un guion y cuatro caracteres (ej: QNT-7K4P).' }
  }
  return { codigo: `${partesCodigo[1]}-${partesCodigo[2]}` }
}
