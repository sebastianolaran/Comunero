// Estado de una carga contra el backend: cargando o error con reintento.
function LoadState({ estado, onRetry }) {
  if (estado === 'loading') {
    return <p className="notice">Cargando…</p>
  }

  return (
    <div className="notice" role="alert">
      <p>No se pudieron cargar los datos.</p>
      <p className="notice__hint">
        El backend corre en el free tier de Render: si estuvo inactivo un rato, el primer
        request puede tardar ~30–50 s en despertar el servicio.
      </p>
      <button type="button" className="notice__retry" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

export default LoadState
