import { useId, useState } from 'react'
import { validarVoto } from '../lib/rentalRequests'
import { voteRentalRequest } from '../services/rentalRequest'

const VOTOS = { APPROVE: 'que sí', REJECT: 'que no' }

function RentalVote({ solicitud, userId, onVoted }) {
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const idMotivo = useId()
  const idError = useId()

  if (!userId) {
    return (
      <p className="voto-aviso">
        Configurá <code>VITE_DEMO_USER_ID</code> para poder votar.
      </p>
    )
  }

  async function votar(value) {
    const { error: invalido, voto } = validarVoto({ value, reason: motivo })
    if (invalido) {
      setError(invalido)
      return
    }
    setEnviando(true)
    setError(null)
    try {
      onVoted(await voteRentalRequest(solicitud.id, { userId, ...voto }))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function cancelarRechazo() {
    setRechazando(false)
    setMotivo('')
    setError(null)
  }

  return (
    <div className="voto">
      {solicitud.myVote && (
        <p className="voto-actual">
          Votaste {VOTOS[solicitud.myVote]}. Podés cambiar tu voto mientras siga pendiente.
        </p>
      )}

      {rechazando ? (
        <div className="voto-rechazo">
          <label htmlFor={idMotivo} className="voto-label">
            Motivo del rechazo
          </label>
          <textarea
            id={idMotivo}
            className="voto-motivo"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? idError : undefined}
          />
          <div className="voto-acciones">
            <button type="button" className="voto-boton" onClick={cancelarRechazo} disabled={enviando}>
              Cancelar
            </button>
            <button
              type="button"
              className="voto-boton is-primario"
              onClick={() => votar('REJECT')}
              disabled={enviando}
            >
              Confirmar rechazo
            </button>
          </div>
        </div>
      ) : (
        <div className="voto-acciones">
          <button
            type="button"
            className="voto-boton is-primario"
            aria-pressed={solicitud.myVote === 'APPROVE'}
            onClick={() => votar('APPROVE')}
            disabled={enviando}
          >
            Votar que sí
          </button>
          <button
            type="button"
            className="voto-boton"
            onClick={() => {
              setRechazando(true)
              setError(null)
            }}
            disabled={enviando}
          >
            Votar que no
          </button>
        </div>
      )}

      {error && (
        <p id={idError} className="voto-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default RentalVote
