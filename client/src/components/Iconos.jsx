const TRAZOS = {
  mas: <path d="M12 5v14M5 12h14" />,
  llave: (
    <>
      <circle cx="7.5" cy="15.5" r="4" />
      <path d="M10.4 12.6 20 3M16 7l3 3M14 9l2 2" />
    </>
  ),
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  atras: <path d="M15 18l-6-6 6-6" />,
  copiar: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  ojo: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ojoTachado: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
}

function Icono({ nombre, className = 'btn__i' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {TRAZOS[nombre]}
    </svg>
  )
}

export default Icono
