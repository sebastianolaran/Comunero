import { Fragment, useState } from 'react'
import { dayLabel, fmtMoney, myPartLabel, shareNote } from '../lib/movements'

function MovementDetail({ movement, meId }) {
  const who = (share) => (share.userId === meId ? 'Vos' : share.name)
  const isIncome = movement.type === 'INCOME'
  return (
    <div className="mov-detail">
      <div>
        <p className="mov-detail-title">
          {isIncome ? 'Cobrado' : 'Pagado'} por {movement.paidBy.id === meId ? 'vos' : movement.paidBy.name}:{' '}
          {fmtMoney(movement.amount)} · así se repartió:
        </p>
        <ul className="mov-share-list">
          {movement.shares.map((share) => (
            <li key={share.userId} className={share.userId === meId ? 'is-me' : undefined}>
              <span>
                {who(share)}
                <span className="mov-share-note">{shareNote(movement, share, meId)}</span>
              </span>
              <span>{fmtMoney(share.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
      {movement.items.length > 0 && (
        <div>
          <p className="mov-detail-title">Desglose</p>
          <ul className="mov-share-list">
            {movement.items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.description}
                  <span className="mov-item-shares">
                    {item.shares.map(who).join(', ')} · {fmtMoney(Math.floor(item.amount / item.shares.length))} c/u
                  </span>
                </span>
                <span>{fmtMoney(item.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {movement.recurring && (
        <p className="mov-detail-rule">Recurrente: se genera solo el 1° de cada mes, con el mismo monto y reparto.</p>
      )}
    </div>
  )
}

function MovementsTable({ movements, meId, emptyText, onEdit, onDelete }) {
  const [openId, setOpenId] = useState(null)

  if (movements.length === 0) {
    return <p className="panel empty">{emptyText}</p>
  }

  return (
    <div className="card card--flush mov-table-wrap">
      <table className="mov-table">
        <thead>
          <tr className="tbl__h">
            <th scope="col">Fecha</th>
            <th scope="col">Descripción</th>
            <th scope="col" className="mov-num">
              Monto
            </th>
            <th scope="col">Gestionó</th>
            <th scope="col" className="mov-num">
              Te toca
            </th>
            <th scope="col">
              <span className="solo-lector">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => {
            const part = myPartLabel(movement.myPart)
            const open = openId === movement.id
            return (
              <Fragment key={movement.id}>
                <tr className={open ? 'tbl__r row-hit is-open' : 'tbl__r row-hit'}>
                  <td className="mov-date">{dayLabel(movement.date)}</td>
                  <td>
                    <div className="mov-desc">
                      {movement.type === 'INCOME' && <span className="tag">Ingreso</span>}
                      {movement.recurring && <span className="tag tag--dash">Recurrente</span>}
                      {movement.items.length > 0 && <span className="tag tag--solid">Desglosado</span>}
                      <span className="mov-desc-t" title={movement.description}>
                        {movement.description}
                      </span>
                      <button
                        type="button"
                        className="idot"
                        aria-expanded={open}
                        aria-label={`Ver el reparto de ${movement.description}`}
                        title="Ver el reparto"
                        onClick={() => setOpenId(open ? null : movement.id)}
                      >
                        i
                      </button>
                    </div>
                  </td>
                  <td className="mov-num money">
                    <span className={movement.type === 'INCOME' ? 'mov-arrow-in' : 'mov-arrow-out'} aria-hidden="true">
                      {movement.type === 'INCOME' ? '↑' : '↓'}
                    </span>{' '}
                    {fmtMoney(movement.amount)}
                  </td>
                  <td>{movement.paidBy.name}</td>
                  <td className="mov-num">
                    <span className={`mov-part mov-tone-${part.tone}`}>{part.text}</span>
                    <span className="mov-part-sub">{part.sub}</span>
                  </td>
                  <td className="mov-row-actions">
                    <button
                      type="button"
                      className="btn btn--link"
                      onClick={() => onEdit(movement)}
                      aria-label={`Editar ${movement.description}`}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn--link"
                      onClick={() => onDelete(movement)}
                      aria-label={`Eliminar ${movement.description}`}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr className="mov-detail-row">
                    <td colSpan={6}>
                      <MovementDetail movement={movement} meId={meId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default MovementsTable
