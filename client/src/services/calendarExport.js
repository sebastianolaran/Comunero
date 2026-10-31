// Con extensión para que node --test lo pueda importar.
import { API_URL } from '../lib/api.js'
import { nombreDeDescarga } from '../lib/calendarExport.js'

// { archivo, nombre }: el .ics con las reservas aprobadas de hoy en adelante
// del bien, para importar a mano en Google Calendar. scope: mine | use | all.
// TODO: el userId sale de la sesión cuando exista el login.
export async function fetchCalendarioIcs({ userId, assetId, scope }) {
  const params = new URLSearchParams({ userId, assetId, scope })
  let res
  try {
    res = await fetch(`${API_URL}/api/calendar/export.ics?${params}`)
  } catch {
    throw new Error('No pudimos conectarnos. Probá de nuevo en un momento.')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error ?? 'No se pudo exportar el calendario.')
  }

  return { archivo: await res.blob(), nombre: nombreDeDescarga(res.headers.get('Content-Disposition')) }
}
