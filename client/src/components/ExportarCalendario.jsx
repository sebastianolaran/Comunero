import { useEffect, useId, useRef, useState } from 'react'
import { OPCIONES_EXPORTAR } from '../lib/calendarExport'
import { fetchCalendarioIcs } from '../services/calendarExport'
import './ExportarCalendario.css'

// Botón "Exportar" que abre un modal para bajar un .ics con lo aprobado de
// hoy en adelante, para importarlo a mano en Google Calendar. Recibe el bien
// por props para poder montarlo fuera del calendario (ej. en Mis bienes).
function ExportarCalendario({ assetId, userId }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button type="button" className="btn btn--block btn--sm" onClick={() => setAbierto(true)}>
        Exportar calendario
      </button>
      {abierto && <ModalExportar assetId={assetId} userId={userId} onClose={() => setAbierto(false)} />}
    </>
  )
}

// Se monta ya abierto, igual que ConfirmDialog; Escape, Cancelar y un clic
// afuera lo cierran.
function ModalExportar({ assetId, userId, onClose }) {
  const dialogo = useRef(null)
  const id = useId()
  const [scope, setScope] = useState('mine')
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    dialogo.current.showModal()
  }, [])

  const exportar = async () => {
    setDescargando(true)
    setError(null)
    try {
      const { archivo, nombre } = await fetchCalendarioIcs({ userId, assetId, scope })
      const url = URL.createObjectURL(archivo)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = nombre
      document.body.append(enlace)
      enlace.click()
      enlace.remove()
      // Revocar en el mismo tick puede cortar la descarga en algunos navegadores.
      setTimeout(() => URL.revokeObjectURL(url), 0)
      onClose()
    } catch (err) {
      setError(err.message)
      setDescargando(false)
    }
  }

  return (
    <dialog
      ref={dialogo}
      className="modal"
      aria-labelledby={`${id}-titulo`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogo.current) onClose()
      }}
    >
      <h2 id={`${id}-titulo`} className="modal__t">
        Exportar a Google Calendar
      </h2>
      <p className="hint exportar-cal__hint">
        Baja un archivo .ics con lo aprobado de hoy en adelante. Se importa en Google Calendar desde
        Configuración → Importar. Tener en cuenta que ante nuevas reservas, se tiene que volver a exportar.
      </p>
      <label className="lbl" htmlFor={`${id}-alcance`}>
        Qué exportar
      </label>
      <select
        id={`${id}-alcance`}
        className="sel exportar-cal__sel"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
      >
        {OPCIONES_EXPORTAR.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>
            {opcion.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="exportar-cal__err" role="alert">
          {error}
        </p>
      )}
      <div className="exportar-cal__acciones">
        <button type="button" className="btn btn--grow" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn--grow btn--primary" onClick={exportar} disabled={descargando}>
          {descargando ? 'Exportando…' : 'Descargar .ics'}
        </button>
      </div>
    </dialog>
  )
}

export default ExportarCalendario
