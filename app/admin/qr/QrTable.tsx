'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { kstDate, lineName, QR_STATUS, QR_TONE } from '@/lib/admin-format'
import { bulkDeleteQr, bulkRetireQr, type BulkState } from '../actions'
import { Badge } from '../ui'

export type QrRow = {
  id: string
  line: 'bang' | 'dot'
  status: string
  lost_mode: boolean
  owner_id: string | null
  order_id: string | null
  created_at: string
  code_used_at: string | null
  failed_attempts: number | null
  locked_until: string | null
}

const init: BulkState = { ok: true, message: '' }

export function QrTable({ rows }: { rows: QrRow[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [delState, delAction, delPending] = useActionState(bulkDeleteQr, init)
  const [retState, retAction, retPending] = useActionState(bulkRetireQr, init)
  const now = useMemo(() => new Date(), [])

  // 등록된(사용 중) QR은 선택 자체를 막는다
  const selectable = rows.filter((r) => r.status !== 'active' && !r.owner_id)
  const allOn = selectable.length > 0 && selectable.every((r) => sel.has(r.id))
  const chosen = rows.filter((r) => sel.has(r.id))
  const canRetire = chosen.filter((r) => r.status === 'issued' || r.status === 'printed').length

  // 처리 후 목록이 바뀌면 사라진 항목은 선택에서 뺀다
  useEffect(() => {
    setSel((prev) => new Set([...prev].filter((id) => rows.some((r) => r.id === id))))
  }, [rows])

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleAll() {
    setSel(allOn ? new Set() : new Set(selectable.map((r) => r.id)))
  }

  const msg = [delState, retState].find((s) => s.message)
  const busy = delPending || retPending

  return (
    <form>
      {[...sel].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      <div className={`ad-selbar${sel.size ? ' on' : ''}`}>
        <span>
          {sel.size ? (
            <>
              <b>{sel.size}개</b> 선택됨
            </>
          ) : (
            '왼쪽 칸을 눌러 여러 개를 고를 수 있어요'
          )}
        </span>
        {sel.size > 0 && (
          <span className="ad-selbar-btns">
            <button type="button" className="ad-btn sm" onClick={() => setSel(new Set())}>
              선택 해제
            </button>
            <button
              type="submit"
              className="ad-btn sm"
              formAction={retAction}
              disabled={busy || canRetire === 0}
              title={canRetire === 0 ? '발급됨·인쇄 넘김 상태만 폐기할 수 있어요' : undefined}
              onClick={(e) => {
                if (!window.confirm(`${canRetire}개를 폐기할까요? 폐기한 QR은 목록에 남고 다시 쓸 수 없어요.`)) e.preventDefault()
              }}
            >
              {retPending ? '폐기 중…' : `폐기 ${canRetire}`}
            </button>
            <button
              type="submit"
              className="ad-btn sm danger"
              formAction={delAction}
              disabled={busy}
              onClick={(e) => {
                if (
                  !window.confirm(
                    `${sel.size}개를 완전히 삭제할까요?\n목록과 스캔 기록에서 사라지고 되돌릴 수 없어요.\n이미 케이스에 인쇄했다면 그 케이스의 QR은 "없는 주소"가 돼요.`,
                  )
                )
                  e.preventDefault()
              }}
            >
              {delPending ? '삭제 중…' : `삭제 ${sel.size}`}
            </button>
          </span>
        )}
      </div>
      {msg && <p className={`ad-flash ${msg.ok ? 'ok' : 'err'}`}>{msg.message}</p>}

      <div className="ad-card flush">
        <div className="ad-scroll">
          <table className="ad-table">
            <thead>
              <tr>
                <th className="ad-check">
                  <input type="checkbox" checked={allOn} onChange={toggleAll} disabled={!selectable.length} aria-label="전체 선택" />
                </th>
                <th>QR ID</th>
                <th>라인</th>
                <th>상태</th>
                <th>발급일</th>
                <th>고객 등록일</th>
                <th>코드 틀린 횟수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const locked = r.locked_until && new Date(r.locked_until) > now
                const inUse = r.status === 'active' || !!r.owner_id
                return (
                  <tr key={r.id} className={sel.has(r.id) ? 'sel' : undefined} onClick={(e) => {
                    if (inUse) return
                    const t = e.target as HTMLElement
                    if (t.closest('a,button,input')) return
                    toggle(r.id)
                  }}>
                    <td className="ad-check">
                      <input
                        type="checkbox"
                        checked={sel.has(r.id)}
                        onChange={() => toggle(r.id)}
                        disabled={inUse}
                        aria-label={`${r.id} 선택`}
                        title={inUse ? '고객이 등록한 QR은 고를 수 없어요' : undefined}
                      />
                    </td>
                    <td>
                      <a className="ad-id" href={`/c/${r.id}`} target="_blank" rel="noreferrer" title="QR 찍은 화면 열기">
                        {r.id} ↗
                      </a>
                    </td>
                    <td>{lineName(r.line)}</td>
                    <td>
                      <span className="ad-badges">
                        <Badge tone={QR_TONE[r.status]}>{QR_STATUS[r.status]}</Badge>
                        {r.lost_mode && <Badge tone="purple">분실 모드</Badge>}
                        {r.order_id && <Badge tone="blue">주문 연결</Badge>}
                      </span>
                    </td>
                    <td className="ad-sub">{kstDate(r.created_at)}</td>
                    <td className="ad-sub">{kstDate(r.code_used_at)}</td>
                    <td>
                      {r.failed_attempts ? r.failed_attempts : <span className="ad-sub">0</span>}
                      {locked && (
                        <>
                          {' '}
                          <Badge tone="red">잠김</Badge>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  )
}
