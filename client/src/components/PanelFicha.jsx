import { useEffect, useId, useRef, useState } from 'react'
import { assetIdActual, assetNameActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { API_URL } from '../lib/api'
import {
  achicarFoto,
  hacerPortada,
  leerServicios,
  linkParaCompartir,
  linkPublico,
  moverFoto,
  whatsappUrl,
} from '../lib/listing'
import { formatMoney } from '../lib/rentalRequests'
import { useCopiado } from '../lib/useCopiado'
import {
  deleteListingPhoto,
  coownerPhotoUrl,
  fetchListing,
  regenerateListingLink,
  reorderListingPhotos,
  saveListing,
  setListingPublished,
  uploadListingPhoto,
} from '../services/listing'
import ConfirmDialog from './ConfirmDialog'
import Icono from './Iconos'
import { Panel, Pie } from './ConfigPanel'
import './PanelFicha.css'

const MAX_FOTOS = 6

const AYUDA =
  'Lo que ve cualquier persona que abra el link, sin necesidad de cuenta. Desde ahí puede pedir fechas: el pedido llega a Alquiler como una solicitud más, que se vota igual que las demás.'

function borradorDe(ficha) {
  return {
    description: ficha.description ?? '',
    capacity: ficha.capacity == null ? '' : String(ficha.capacity),
    services: ficha.services.join('\n'),
    approxLocation: ficha.approxLocation ?? '',
    conditions: ficha.conditions ?? '',
  }
}

function leerBorrador(borrador) {
  const capacidad = borrador.capacity.trim()
  if (capacidad !== '' && !/^\d+$/.test(capacidad)) return { error: 'Capacidad: tiene que ser un número entero.' }
  return {
    ficha: {
      description: borrador.description,
      capacity: capacidad === '' ? null : Number(capacidad),
      services: leerServicios(borrador.services),
      approxLocation: borrador.approxLocation,
      conditions: borrador.conditions,
    },
  }
}

function Campo({ label, children, hint }) {
  return (
    <label className="lbl ficha__campo">
      {label}
      {children}
      {hint && <span className="meta ficha__hint">{hint}</span>}
    </label>
  )
}

function LinkPublico({ ficha, onCambio }) {
  const { copiado, copiar } = useCopiado()
  const [estado, setEstado] = useState({ ocupado: false, error: null })
  const [confirmando, setConfirmando] = useState(false)
  const idSwitch = useId()
  const slug = ficha.publicSlug
  if (!slug) {
    return <p className="note">El link se genera al guardar la ficha por primera vez.</p>
  }

  async function correr(accion) {
    setEstado({ ocupado: true, error: null })
    try {
      onCambio(await accion())
      setEstado({ ocupado: false, error: null })
      return true
    } catch (err) {
      setEstado({ ocupado: false, error: err.message })
      return false
    }
  }

  async function generarNuevo() {
    if (await correr(() => regenerateListingLink(assetIdActual(), userIdActual()))) setConfirmando(false)
  }

  const link = linkParaCompartir(API_URL, slug)
  const pausada = !ficha.published
  return (
    <div className="ficha__link">
      <div className="ficha__estado">
        <label className="ficha__switch" htmlFor={idSwitch}>
          <input
            id={idSwitch}
            type="checkbox"
            role="switch"
            checked={ficha.published}
            disabled={estado.ocupado}
            onChange={(e) => correr(() => setListingPublished(assetIdActual(), userIdActual(), e.target.checked))}
          />
          <span className="ficha__switch-pista" aria-hidden="true" />
          {pausada ? 'Ficha pausada' : 'Ficha publicada'}
        </label>
        <button
          type="button"
          className="btn btn--link"
          disabled={estado.ocupado}
          onClick={() => {
            setEstado({ ocupado: false, error: null })
            setConfirmando(true)
          }}
        >
          Generar link nuevo
        </button>
      </div>
      {pausada && (
        <p className="note">Mientras está pausada, el link muestra que la ficha no existe y no recibe pedidos.</p>
      )}
      <input className="in ficha__url" readOnly value={link} aria-label="Link público" onFocus={(e) => e.target.select()} />
      <div className="ficha__link-acciones">
        <button type="button" className="btn btn--sm" disabled={pausada} onClick={() => copiar(link)}>
          {copiado ? 'Link copiado' : 'Copiar link'}
        </button>
        <a
          className={pausada ? 'btn btn--sm is-off' : 'btn btn--sm'}
          aria-disabled={pausada || undefined}
          href={pausada ? undefined : whatsappUrl(link, assetNameActual() ?? 'Ficha')}
          target="_blank"
          rel="noopener noreferrer"
        >
          Compartir por WhatsApp
        </a>
        {!pausada && (
          <a className="btn btn--sm btn--link" href={linkPublico(window.location.origin, slug)} target="_blank" rel="noopener noreferrer">
            Ver ficha
          </a>
        )}
      </div>
      {estado.error && !confirmando && (
        <p className="cfg__error" role="alert">
          {estado.error}
        </p>
      )}
      {confirmando && (
        <ConfirmDialog
          title="¿Generar un link nuevo?"
          lines={[
            'El link actual deja de andar: quien lo tenga va a ver que la ficha no existe.',
            'Después hay que volver a compartir el link nuevo.',
          ]}
          confirmLabel="Generar link nuevo"
          busyLabel="Generando…"
          busy={estado.ocupado}
          error={estado.error}
          onConfirm={generarNuevo}
          onCancel={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}

function Fotos({ ficha, onCambio }) {
  const input = useRef(null)
  const [estado, setEstado] = useState({ ocupado: false, error: null })
  const lleno = ficha.photos.length >= MAX_FOTOS
  const ids = ficha.photos.map((f) => f.id)
  const ordenar = (nuevos) => correr(() => reorderListingPhotos(assetIdActual(), userIdActual(), nuevos))

  // Devuelve si salió bien, para cortar una subida de varias en el primer error.
  async function correr(accion) {
    setEstado({ ocupado: true, error: null })
    try {
      onCambio(await accion())
      setEstado({ ocupado: false, error: null })
      return true
    } catch (err) {
      setEstado({ ocupado: false, error: err.message })
      return false
    }
  }

  async function subir(archivos) {
    const lugar = MAX_FOTOS - ficha.photos.length
    const elegidos = [...archivos]
    for (const [i, archivo] of elegidos.slice(0, lugar).entries()) {
      const ok = await correr(async () => uploadListingPhoto(assetIdActual(), userIdActual(), await achicarFoto(archivo)))
      if (!ok) {
        const restantes = Math.min(elegidos.length, lugar) - i - 1
        if (restantes > 0) setEstado((prev) => ({ ...prev, error: `${prev.error} Quedaron ${restantes + 1} fotos sin subir.` }))
        break
      }
    }
    if (elegidos.length > lugar) {
      setEstado((prev) => ({ ...prev, error: prev.error ?? `Se subieron solo ${lugar}: el máximo es ${MAX_FOTOS} fotos.` }))
    }
    if (input.current) input.current.value = ''
  }

  return (
    <div className="ficha__fotos">
      <div className="ficha__fotos-head">
        <span className="lbl">
          Fotos ({ficha.photos.length}/{MAX_FOTOS})
        </span>
        <button
          type="button"
          className="btn btn--sm"
          disabled={lleno || estado.ocupado}
          onClick={() => input.current?.click()}
        >
          {estado.ocupado ? 'Subiendo…' : 'Subir fotos'}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => subir(e.target.files)}
        />
      </div>
      {ficha.photos.length > 0 ? (
        <ul className="ficha__grilla">
          {ficha.photos.map((foto, i) => (
            <li key={foto.id} className="ficha__foto">
              <img src={coownerPhotoUrl(assetIdActual(), userIdActual(), foto.id)} alt={`Foto ${i + 1} del bien`} loading="lazy" />
              {i === 0 ? (
                <span className="ficha__portada">Portada</span>
              ) : (
                <button
                  type="button"
                  className="ficha__chip"
                  disabled={estado.ocupado}
                  onClick={() => ordenar(hacerPortada(ids, i))}
                >
                  Usar de portada
                </button>
              )}
              <div className="ficha__foto-acciones">
                <button
                  type="button"
                  className="ficha__mini"
                  aria-label={`Mover la foto ${i + 1} antes`}
                  disabled={estado.ocupado || i === 0}
                  onClick={() => ordenar(moverFoto(ids, i, -1))}
                >
                  <Icono nombre="atras" className="btn__i" />
                </button>
                <button
                  type="button"
                  className="ficha__mini"
                  aria-label={`Mover la foto ${i + 1} después`}
                  disabled={estado.ocupado || i === ficha.photos.length - 1}
                  onClick={() => ordenar(moverFoto(ids, i, 1))}
                >
                  <Icono nombre="siguiente" className="btn__i" />
                </button>
                <button
                  type="button"
                  className="ficha__mini ficha__mini--texto"
                  disabled={estado.ocupado}
                  onClick={() => correr(() => deleteListingPhoto(assetIdActual(), userIdActual(), foto.id))}
                >
                  Sacar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Sin fotos todavía. JPG, PNG o WebP; se achican solas antes de subirse.</p>
      )}
      {estado.error && (
        <p className="cfg__error" role="alert">
          {estado.error}
        </p>
      )}
    </div>
  )
}

function FormularioFicha({ ficha, precioPorDia, onCambio }) {
  const [borrador, setBorrador] = useState(() => borradorDe(ficha))
  const [estado, setEstado] = useState({ guardando: false, error: null, guardado: false })
  const idCapacidad = useId()
  const cambiar = (campo) => (e) => setBorrador((prev) => ({ ...prev, [campo]: e.target.value }))
  const sinCambios = JSON.stringify(borrador) === JSON.stringify(borradorDe(ficha))

  async function guardar() {
    const { ficha: nueva, error } = leerBorrador(borrador)
    if (error) return setEstado({ guardando: false, error, guardado: false })
    setEstado({ guardando: true, error: null, guardado: false })
    try {
      const guardada = await saveListing(assetIdActual(), userIdActual(), nueva)
      setBorrador(borradorDe(guardada))
      setEstado({ guardando: false, error: null, guardado: true })
      onCambio(guardada)
    } catch (err) {
      setEstado({ guardando: false, error: err.message, guardado: false })
    }
  }

  return (
    <>
      <div className="ficha__campos">
        <Campo label="Descripción">
          <textarea className="ta" rows={4} maxLength={2000} value={borrador.description} onChange={cambiar('description')} />
        </Campo>
        <div className="ficha__par">
          <label className="lbl ficha__campo" htmlFor={idCapacidad}>
            Capacidad
            <span className="ficha__ctl">
              <input
                id={idCapacidad}
                className="in in--num"
                inputMode="numeric"
                placeholder="Sin dato"
                value={borrador.capacity}
                onChange={cambiar('capacity')}
              />
              <span className="meta">personas</span>
            </span>
          </label>
          <div className="lbl ficha__campo">
            Precio de referencia
            <p className="ficha__precio">{precioPorDia == null ? 'Sin precio' : `${formatMoney(precioPorDia)} por día`}</p>
            <span className="meta ficha__hint">Es el costo por día de Alquiler a terceros.</span>
          </div>
        </div>
        <Campo label="Servicios" hint="Uno por renglón o separados por coma.">
          <textarea className="ta" rows={3} value={borrador.services} onChange={cambiar('services')} />
        </Campo>
        <Campo label="Ubicación aproximada" hint="Zona o referencia, sin la dirección exacta.">
          <input className="in" maxLength={120} value={borrador.approxLocation} onChange={cambiar('approxLocation')} />
        </Campo>
        <Campo label="Condiciones de alquiler">
          <textarea className="ta" rows={3} maxLength={2000} value={borrador.conditions} onChange={cambiar('conditions')} />
        </Campo>
      </div>
      <Pie estado={estado} onGuardar={guardar} sinCambios={sinCambios} />
    </>
  )
}

// onCambio: para refrescar "Cambios recientes", donde queda quién la modificó.
function PanelFicha({ precioPorDia, onCambio }) {
  const [carga, setCarga] = useState({ estado: 'loading', ficha: null })

  useEffect(() => {
    const controller = new AbortController()
    fetchListing(assetIdActual(), userIdActual(), { signal: controller.signal })
      .then((ficha) => setCarga({ estado: 'ok', ficha }))
      .catch((err) => {
        if (err.name !== 'AbortError') setCarga({ estado: 'error', ficha: null, error: err.message })
      })
    return () => controller.abort()
  }, [])

  const actualizar = (ficha) => {
    setCarga({ estado: 'ok', ficha })
    onCambio()
  }

  return (
    <Panel
      titulo="Ficha pública"
      ayuda={AYUDA}
      hint="Para compartir con posibles inquilinos. Cualquier integrante la puede editar."
    >
      {carga.estado === 'loading' && (
        <p className="empty" role="status">
          Cargando ficha…
        </p>
      )}
      {carga.estado === 'error' && (
        <p className="cfg__error" role="alert">
          {carga.error}
        </p>
      )}
      {carga.estado === 'ok' && (
        <div className="ficha">
          <LinkPublico ficha={carga.ficha} onCambio={actualizar} />
          <Fotos ficha={carga.ficha} onCambio={actualizar} />
          <FormularioFicha ficha={carga.ficha} precioPorDia={precioPorDia} onCambio={actualizar} />
        </div>
      )}
    </Panel>
  )
}

export default PanelFicha
