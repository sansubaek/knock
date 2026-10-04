'use client'

import { keepForm } from '@/components/keepForm'
import { useActionState } from 'react'
import { inquiryAction } from '@/app/forms-actions'

const TYPES: [string, string][] = [
  ['general', '일반 문의'],
  ['code', '코드 재발급 (카드 분실)'],
  ['lost', '케이스를 주웠어요'],
  ['report', '페이지 신고'],
  ['other', '기타'],
]

export function SupportForm({ type, target, email }: { type: string; target: string; email: string }) {
  const [state, action, pending] = useActionState(inquiryAction, { ok: false, message: '' })
  if (state.ok) {
    return (
      <div className="done-box" role="status">
        <b>보냈어요</b>
        <p>{state.message}</p>
      </div>
    )
  }
  return (
    <form onSubmit={keepForm(action)} className="form-card">
      <div className="hp" aria-hidden="true">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label>
        종류
        <select name="type" defaultValue={TYPES.some(([k]) => k === type) ? type : 'general'}>
          {TYPES.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        케이스 주소 끝 6자리 (알면)
        <input name="target" maxLength={40} defaultValue={target} placeholder="예: A7K2QX" />
      </label>
      <label>
        답장 받을 이메일
        <input name="email" type="email" maxLength={120} required defaultValue={email} />
      </label>
      <label>
        내용
        <textarea name="body" maxLength={2000} rows={6} required />
      </label>
      <p className="gb-note">코드 재발급은 주문하신 분 이름과 받은 주소를 같이 적어주시면 빨라요.</p>
      <button type="submit" disabled={pending}>
        {pending ? '보내는 중…' : '보내기'}
      </button>
      {state.message && <p className="v-msg err">{state.message}</p>}
    </form>
  )
}
