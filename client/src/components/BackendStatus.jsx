import { useEffect, useState } from 'react'
import { API_URL } from '../lib/api'
import './BackendStatus.css'

// Render apaga el server si nadie entra un rato y tarda hasta un minuto en
// despertarlo. Con el server andando no se muestra nada; el aviso aparece solo
// si la primera respuesta tarda más de AVISO_MS o si no hay conexión.
const AVISO_MS = 2500

function BackendStatus() {
  const [estado, setEstado] = useState('loading')
  const [lento, setLento] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let vivo = true
    const timer = setTimeout(() => vivo && setLento(true), AVISO_MS)

    fetch(`${API_URL}/api/health/db`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        if (vivo) setEstado(body.db === 'ok' ? 'ok' : 'error')
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setEstado('error')
      })

    return () => {
      vivo = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [intento])

  const reintentar = () => {
    setEstado('loading')
    setLento(false)
    setIntento((n) => n + 1)
  }

  if (estado === 'ok' || (estado === 'loading' && !lento)) return <div className="backend-status" role="status" />

  return (
    <div className="backend-status" role="status">
      {estado === 'loading' ? (
        <p className="backend-status-texto is-loading">Despertando el servidor, puede tardar hasta un minuto…</p>
      ) : (
        <>
          <p className="backend-status-texto is-error">No hay conexión con el servidor.</p>
          <button type="button" className="btn btn--sm" onClick={reintentar}>
            Reintentar
          </button>
        </>
      )}
    </div>
  )
}

export default BackendStatus
