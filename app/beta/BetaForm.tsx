'use client'

import { keepForm } from '@/components/keepForm'
import { useActionState } from 'react'
import { betaAction } from '@/app/forms-actions'

const PHONES = ['아이폰 17 / 17 Pro', '아이폰 16 / 16 Pro', '아이폰 15 / 15 Pro', '아이폰 14 이하', '갤럭시 S25 / S26', '갤럭시 Z 플립 / 폴드', '기타']

export function BetaForm({ line, design }: { line: 'bang' | 'dot'; design: string }) {
  const [state, action, pending] = useActionState(betaAction, { ok: false, message: '' })
  if (state.ok) {
    return (
      <div className="done-box" role="status">
        <b>신청 완료</b>
        <p>{state.message}</p>
      </div>
    )
  }
  return (
    <form onSubmit={keepForm(action)} className="form-card">
      <div className="hp" aria-hidden="true">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <fieldset>
        <legend>어떤 라인이 끌려요?</legend>
        <div className="seg2">
          <label>
            <input type="radio" name="line" value="bang" defaultChecked={line === 'bang'} />
            <span>knock!</span>
          </label>
          <label>
            <input type="radio" name="line" value="dot" defaultChecked={line === 'dot'} />
            <span>knock.</span>
          </label>
        </div>
      </fieldset>
      <label>
        원하는 디자인
        <input name="design" maxLength={60} defaultValue={design} placeholder="예: 깅엄 knock!" />
      </label>
      <label>
        이름 또는 닉네임
        <input name="name" maxLength={30} required autoComplete="nickname" />
      </label>
      <label>
        폰 기종
        <select name="phone" defaultValue={PHONES[0]}>
          {PHONES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label>
        연락받을 곳 (이메일 또는 인스타)
        <input name="contact" maxLength={80} required />
      </label>
      <label className="check">
        <input type="checkbox" name="agree" />
        <span>
          베타 선정 연락과 케이스 발송을 위해 이름, 연락처, 폰 기종을 모으는 데 동의해요. 베타가 끝나면 3개월 안에 지워요. (<a href="/privacy">개인정보처리방침</a>)
        </span>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? '보내는 중…' : '베타 신청하기'}
      </button>
      {state.message && <p className="v-msg err">{state.message}</p>}
    </form>
  )
}
