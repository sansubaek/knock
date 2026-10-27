'use client'

import { useActionState } from 'react'
import { issueBatch, issueForOrder, reissueCode, type IssueState } from './actions'
import { IssueResult } from './IssueResult'

const init: IssueState = { ok: false, message: '', items: [] }

export function BatchIssue() {
  const [state, action, pending] = useActionState(issueBatch, init)
  return (
    <div>
      <form action={action} className="adm-form no-print">
        <div className="adm-field">
          <span>라인</span>
          <div className="adm-seg" role="radiogroup" aria-label="라인">
            <label>
              <input type="radio" name="line" value="bang" defaultChecked />
              <span>knock!</span>
            </label>
            <label>
              <input type="radio" name="line" value="dot" />
              <span>knock.</span>
            </label>
          </div>
        </div>
        <label className="adm-field">
          <span>개수 (최대 200)</span>
          <input className="adm-input num" name="count" type="number" min={1} max={200} defaultValue={10} />
        </label>
        <button type="submit" className="adm-btn primary" disabled={pending}>
          {pending ? '발급 중…' : 'QR + 코드 발급'}
        </button>
      </form>
      {state.message && <p className={`adm-msg ${state.ok ? 'ok' : 'err'} no-print`}>{state.message}</p>}
      <IssueResult items={state.items} />
    </div>
  )
}

export function OrderIssue({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(issueForOrder, init)
  return (
    <div className="adm-order-issue">
      {state.items.length === 0 && (
        <form action={action}>
          <input type="hidden" name="order" value={orderId} />
          <button type="submit" className="adm-btn sm" disabled={pending}>
            {pending ? '발급 중…' : '이 주문에 QR 발급'}
          </button>
        </form>
      )}
      {state.message && <p className={`adm-msg ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>}
      <IssueResult items={state.items} />
    </div>
  )
}

export function Reissue() {
  const [state, action, pending] = useActionState(reissueCode, init)
  return (
    <div>
      <form action={action} className="adm-form no-print">
        <label className="adm-field">
          <span>QR ID (케이스 QR 아래 6자리 영문·숫자)</span>
          <input className="adm-input mono" name="qr" maxLength={8} placeholder="A7K2QX" required />
        </label>
        <button type="submit" className="adm-btn" disabled={pending}>
          {pending ? '만드는 중…' : '새 코드 만들기'}
        </button>
      </form>
      {state.message && <p className={`adm-msg ${state.ok ? 'ok' : 'err'} no-print`}>{state.message}</p>}
      <IssueResult items={state.items} />
    </div>
  )
}
