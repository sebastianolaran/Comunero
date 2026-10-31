import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import AssetCard from '../components/AssetCard'
import Icono from '../components/Iconos'
import JoinAssetModal from '../components/JoinAssetModal'
import NewAssetModal from '../components/NewAssetModal'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
import { iniciales } from '../lib/assets'
import { cerrarSesion, elegirBien, leerSesion } from '../lib/session'
import { createAsset, fetchAssets, joinAsset } from '../services/asset'
import './MisBienes.css'

function MisBienes() {
  const navigate = useNavigate()
  const usuario = leerSesion()
  const [carga, setCarga] = useState({ estado: 'cargando', bienes: [], error: null })
  const [intento, setIntento] = useState(0)
  const [modal, setModal] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchAssets(usuario.id, { signal: controller.signal })
      .then((bienes) => setCarga({ estado: 'listo', bienes, error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setCarga({ estado: 'error', bienes: [], error: err.message })
      })
    return () => controller.abort()
  }, [usuario.id, intento])

  const entrar = (bien) => {
    elegirBien(bien)
    navigate('/calendario')
  }

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  const cerrarModal = () => {
    setModal(null)
    setIntento((n) => n + 1)
  }

  const crear = (nombre) => createAsset({ userId: usuario.id, name: nombre })
  const unirse = (codigo) => joinAsset({ userId: usuario.id, code: codigo })

  return (
    <div className="bienes">
      <header className="bienes__top">
        <span className="bienes__marca">Comunero</span>
        <div className="who">
          <span className="who__a" aria-hidden="true">
            {iniciales(usuario.name)}
          </span>
          {usuario.name}
          <button type="button" className="btn btn--link who__out" onClick={salir}>
            Salir
          </button>
        </div>
      </header>

      <main className="bienes__main">
        <div className="bienes__cab">
          <div>
            <h1 className="bienes__t">Bienes compartidos</h1>
            <p className="bienes__s">
              Elegir uno para ver su calendario. Si todavía no está, se puede crear o unirse con el código del grupo.
            </p>
          </div>
          <div className="bienes__acc">
            <button type="button" className="btn bienes__btn" onClick={() => setModal('unirme')}>
              <Icono nombre="llave" />
              Unirse con código
            </button>
            <button type="button" className="btn btn--primary bienes__btn" onClick={() => setModal('crear')}>
              <Icono nombre="mas" />
              Crear bien
            </button>
          </div>
        </div>

        {carga.estado === 'cargando' && carga.bienes.length === 0 && (
          <Cargando filas={2}>Cargando bienes…</Cargando>
        )}

        {carga.estado === 'error' && (
          <ErrorCarga titulo={carga.error} onReintentar={() => setIntento((n) => n + 1)} />
        )}

        {carga.estado === 'listo' && carga.bienes.length === 0 && (
          <Vacio panel titulo="Todavía no hay bienes.">
            Quien empieza crea el bien y comparte el código; el resto del grupo se une con ese código.
          </Vacio>
        )}

        {carga.bienes.length > 0 && (
          <div className="bienes__grilla">
            {carga.bienes.map((bien) => (
              <AssetCard key={bien.id} bien={bien} onElegir={entrar} />
            ))}
          </div>
        )}
      </main>

      <NewAssetModal abierto={modal === 'crear'} onClose={cerrarModal} onCreate={crear} onIr={entrar} />
      <JoinAssetModal abierto={modal === 'unirme'} onClose={cerrarModal} onJoin={unirse} onIr={entrar} />
    </div>
  )
}

export default MisBienes
