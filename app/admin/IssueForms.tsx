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
        <label>
          라인
          <select name="line" defaultValue="bang">
            <option value="bang">knock!</option>
            <option value="dot">knock.</option>
          </select>
        </label>
        <label>
          개수 (최대 200)
          <input name="count" type="number" min={1} max={200} defaultValue={10} />
        </label>
        <button type="submit" className="btn-s solid" disabled={pending}>
          {pending ? '발급 중…' : 'QR + 코드 발급'}
        </button>
      </form>
      {state.message && <p className={`v-msg ${state.ok ? 'ok' : 'err'} no-print`}>{state.message}</p>}
      <IssueResult items={state.items} />
    </div>
  )
}

export function OrderIssue({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(issueForOrder, init)
  return (
    <div>
      {state.items.length === 0 && (
        <form action={action}>
          <input type="hidden" name="order" value={orderId} />
          <button type="submit" className="btn-s" disabled={pending}>
            {pending ? '발급 중…' : 'QR 발급'}
          </button>
        </form>
      )}
      {state.message && <p className={`v-msg ${state.ok ? 'ok' : 'err'} small`}>{state.message}</p>}
      <IssueResult items={state.items} />
    </div>
  )
}

export function Reissue() {
  const [state, action, pending] = useActionState(reissueCode, init)
  return (
    <div>
      <form action={action} className="adm-form no-print">
        <label>
          QR ID
          <input name="qr" maxLength={8} placeholder="A7K2QX" required />
        </label>
        <button type="submit" className="btn-s" disabled={pending}>
          코드 다시 만들기
        </button>
      </form>
      {state.message && <p className={`v-msg ${state.ok ? 'ok' : 'err'} no-print`}>{state.message}</p>}
      <IssueResult items={state.items} />
    </div>
  )
}
