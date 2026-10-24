// Los tres estados de una carga: cargando, falló y vacío. `panel` los
// enmarca como una tarjeta cuando ocupan el lugar de una lista.

const clase = (panel, extra = '') => `${panel ? 'panel ' : ''}estado ${extra}`.trim()

export function Cargando({ children, panel = true }) {
  return (
    <p className={clase(panel)} role="status">
      {children}
    </p>
  )
}

// Render puede tardar en despertar el servidor: el aviso lo dice sin jerga.
export function ErrorCarga({ titulo, onReintentar, panel = true }) {
  return (
    <div className={clase(panel, 'estado--error')} role="alert">
      <p className="estado__t">{titulo}</p>
      <p className="hint">Si nadie entró en un rato, el servidor tarda hasta un minuto en despertarse.</p>
      {onReintentar && (
        <button type="button" className="btn btn--sm" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  )
}

export function Vacio({ titulo, children, panel = false }) {
  return (
    <div className={clase(panel)}>
      <p className="estado__t">{titulo}</p>
      {children && <p className="hint">{children}</p>}
    </div>
  )
}
