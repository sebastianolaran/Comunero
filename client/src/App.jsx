import { useEffect, useState } from 'react'
import { API_URL } from './lib/api'
import './App.css'

const ESTADOS = {
  loading: { texto: 'conectando con el backend…', clase: 'is-loading' },
  ok: { texto: 'backend ok', clase: 'is-ok' },
  error: { texto: 'sin conexión con el backend', clase: 'is-error' },
}

function App() {
  const [estado, setEstado] = useState('loading')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let vivo = true

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
      controller.abort()
    }
  }, [intento])

  const reintentar = () => {
    setEstado('loading')
    setIntento((n) => n + 1)
  }

  const { texto, clase } = ESTADOS[estado]

  return (
    <main className="status">
      <h1>Comunero</h1>
      <p className={`badge ${clase}`}>{texto}</p>
      <p className="api-url">
        API: <code>{API_URL}</code>
      </p>

      {estado !== 'ok' && (
        <p className="hint">
          El backend corre en el free tier de Render: si estuvo inactivo un
          rato, el primer request puede tardar ~30–50 s en despertar el
          servicio. No está roto.
        </p>
      )}

      {estado === 'error' && (
        <button type="button" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </main>
  )
}

export default App
