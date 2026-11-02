// Ficha pública del bien: lo que no depende de React.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TELEFONO = /^[\d\s()+.-]+$/
const MAX_DIAS = 60
const MS_POR_DIA = 24 * 60 * 60 * 1000

export function linkPublico(origen, slug) {
  return `${origen}/ficha/${slug}`
}

export function whatsappUrl(link, nombreDelBien) {
  return `https://wa.me/?text=${encodeURIComponent(`${nombreDelBien}: ${link}`)}`
}

// Un servicio por renglón o separados por coma.
export function leerServicios(texto) {
  return texto
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function diasEntre(desde, hasta) {
  return (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA + 1
}

// Mismas reglas que el server, para marcar los campos antes de enviar.
// capacidad: la de la ficha (null = sin tope).
export function validarSolicitudPublica(borrador, { hoy, capacidad = null }) {
  const errores = {}
  if (!borrador.name.trim()) errores.name = 'Falta el nombre.'
  const digitos = borrador.phone.replace(/\D/g, '')
  if (!digitos || !TELEFONO.test(borrador.phone)) errores.phone = 'Falta un teléfono válido.'
  if (borrador.email.trim() && !EMAIL.test(borrador.email.trim())) errores.email = 'El email no es válido.'
  if (!borrador.startDate) errores.startDate = 'Falta la fecha de llegada.'
  else if (borrador.startDate < hoy) errores.startDate = 'La llegada no puede ser anterior a hoy.'
  if (!borrador.endDate) errores.endDate = 'Falta la fecha de salida.'
  else if (borrador.startDate && borrador.endDate < borrador.startDate) {
    errores.endDate = 'La salida no puede ser anterior a la llegada.'
  } else if (borrador.startDate && diasEntre(borrador.startDate, borrador.endDate) > MAX_DIAS) {
    errores.endDate = `Se pueden pedir hasta ${MAX_DIAS} días seguidos.`
  }
  const personas = Number(borrador.guests)
  if (!/^\d+$/.test(borrador.guests.trim()) || personas < 1) errores.guests = 'Falta la cantidad de personas.'
  else if (capacidad != null && personas > capacidad) {
    errores.guests = `El lugar admite hasta ${capacidad} ${capacidad === 1 ? 'persona' : 'personas'}.`
  }
  if (Object.keys(errores).length > 0) return { errores }
  return { errores, pedido: { ...borrador, guests: personas } }
}

// Achica la foto en el navegador antes de subirla: el server guarda hasta ~300 KB.
const LADO_MAXIMO = 1600
const BYTES_OBJETIVO = 200 * 1024
const CALIDADES = [0.82, 0.7, 0.58, 0.46]

function cargarImagen(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}

function aBlob(canvas, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad))
}

function aBase64(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result).split(',')[1])
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    lector.readAsDataURL(blob)
  })
}

export async function achicarFoto(archivo) {
  const img = await cargarImagen(archivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  const ctx = canvas.getContext('2d')
  // JPEG no tiene transparencia: sin fondo, un PNG transparente saldría negro.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  let blob = null
  for (const calidad of CALIDADES) {
    blob = await aBlob(canvas, calidad)
    if (blob && blob.size <= BYTES_OBJETIVO) break
  }
  if (!blob) throw new Error('No se pudo procesar la imagen.')
  return { mimeType: 'image/jpeg', data: await aBase64(blob) }
}
