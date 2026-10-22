function Pagination({ pagina, totalPaginas, setPagina }) {
  if (totalPaginas <= 1) return null

  return (
    <nav className="paginacion" aria-label="Paginación">
      <button
        type="button"
        className="btn btn--sm"
        disabled={pagina === 1}
        onClick={() => setPagina(pagina - 1)}
      >
        Anterior
      </button>
      <div className="paginacion__numeros" aria-label={`Página ${pagina} de ${totalPaginas}`}>
        {Array.from({ length: totalPaginas }, (_, indice) => indice + 1).map((numero) => (
          <button
            key={numero}
            type="button"
            className={numero === pagina ? 'btn btn--sm paginacion__numero paginacion__numero--on' : 'btn btn--sm paginacion__numero'}
            aria-current={numero === pagina ? 'page' : undefined}
            onClick={() => setPagina(numero)}
          >
            {numero}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--sm"
        disabled={pagina === totalPaginas}
        onClick={() => setPagina(pagina + 1)}
      >
        Siguiente
      </button>
    </nav>
  )
}

export default Pagination