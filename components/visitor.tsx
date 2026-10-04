'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import {
  activateAction,
  cardAction,
  guestbookAction,
  knockAction,
  lostMessageAction,
  unlockAction,
  type ActionState,
} from '@/app/c/actions'
import { keepForm } from '@/components/keepForm'

const initial: ActionState = { ok: false, message: '' }

function Msg({ s }: { s: ActionState }) {
  if (!s.message) return null
  return (
    <p className={`v-msg ${s.ok ? 'ok' : 'err'}`} role="status" aria-live="polite">
      {s.message}
    </p>
  )
}

/** 봇이 채우는 숨은 칸. 사람이 채우면 저장하지 않는다 */
function Honeypot() {
  return (
    <div className="hp" aria-hidden="true">
      <label>
        웹사이트
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  )
}

export function KnockButton({ qrId, count, preview }: { qrId?: string; count: number; preview?: boolean }) {
  const [state, action, pending] = useActionState(knockAction, initial)
  const [n, setN] = useState(count)
  const [pop, setPop] = useState(false)
  useEffect(() => {
    if (state.ok && state.message.startsWith('똑똑')) {
      setN((x) => x + 1)
      setPop(true)
      const t = setTimeout(() => setPop(false), 700)
      return () => clearTimeout(t)
    }
  }, [state])
  return (
    <form onSubmit={keepForm(action, preview)} className="knock-wrap">
      <input type="hidden" name="qr" value={qrId ?? ''} />
      <button className={`knock-btn${pop ? ' pop' : ''}`} type="submit" disabled={pending}>
        <span className="knock-hand" aria-hidden="true">✊</span>
        <span>똑똑 노크하기</span>
      </button>
      <p className="knock-count">
        지금까지 <b>{n.toLocaleString()}</b>번 노크했어요
      </p>
      <Msg s={state} />
    </form>
  )
}

export function GuestbookForm({ qrId, preview, approval }: { qrId?: string; preview?: boolean; approval?: boolean }) {
  const [state, action, pending] = useActionState(guestbookAction, initial)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok) ref.current?.reset()
  }, [state])
  return (
    <form ref={ref} onSubmit={keepForm(action, preview)} className="gb-form">
      <input type="hidden" name="qr" value={qrId ?? ''} />
      <Honeypot />
      <input name="nickname" maxLength={12} placeholder="닉네임" aria-label="닉네임" required />
      <textarea name="message" maxLength={200} rows={2} placeholder="한마디 남기고 가기" aria-label="한마디" required />
      <button type="submit" disabled={pending}>
        {pending ? '남기는 중…' : '남기기'}
      </button>
      {approval && <p className="gb-note">주인이 확인한 뒤에 보여요.</p>}
      <Msg s={state} />
    </form>
  )
}

export function CardExchangeForm({ qrId, preview }: { qrId?: string; preview?: boolean }) {
  const [state, action, pending] = useActionState(cardAction, initial)
  const [open, setOpen] = useState(false)
  if (state.ok) return <Msg s={state} />
  if (!open) {
    return (
      <button type="button" className="d-act ghost" onClick={() => setOpen(true)}>
        내 명함 남기기
      </button>
    )
  }
  return (
    <form onSubmit={keepForm(action, preview)} className="card-form">
      <input type="hidden" name="qr" value={qrId ?? ''} />
      <Honeypot />
      <label>
        이름<input name="name" maxLength={30} required autoComplete="name" />
      </label>
      <label>
        소속 · 직함<input name="org" maxLength={40} autoComplete="organization" />
      </label>
      <label>
        연락처 (전화 또는 이메일)<input name="contact" maxLength={60} required />
      </label>
      <label>
        만난 곳 · 메모<input name="memo" maxLength={60} placeholder="예: 10/12 창업 박람회" />
      </label>
      <p className="gb-note">남긴 정보는 이 페이지 주인에게만 보여요.</p>
      <button type="submit" className="d-act" disabled={pending}>
        {pending ? '보내는 중…' : '명함 보내기'}
      </button>
      <Msg s={state} />
    </form>
  )
}

export function LostForm({ qrId }: { qrId: string }) {
  const [state, action, pending] = useActionState(lostMessageAction, initial)
  if (state.ok) {
    return (
      <div className="lost-done" role="status">
        <b>전달했어요</b>
        <p>{state.message}</p>
      </div>
    )
  }
  return (
    <form onSubmit={keepForm(action)} className="lost-form">
      <input type="hidden" name="qr" value={qrId} />
      <Honeypot />
      <label>
        주인에게 남길 말
        <textarea name="message" maxLength={300} rows={3} required placeholder="예: 인하대 정문 앞 카페에 맡겨둘게요" />
      </label>
      <label>
        발견한 곳 (선택)
        <input name="location" maxLength={100} placeholder="예: 2호관 3층 복도" />
      </label>
      <label>
        내 연락처 (선택)
        <input name="contact" maxLength={60} placeholder="남기면 주인이 직접 연락할 수 있어요" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? '보내는 중…' : '주인에게 보내기'}
      </button>
      <p className="gb-note">서로의 번호는 공개되지 않아요. 남긴 연락처는 주인에게만 보여요.</p>
      <Msg s={state} />
    </form>
  )
}

export function UnlockForm({ qrId }: { qrId: string }) {
  const [state, action, pending] = useActionState(unlockAction, initial)
  return (
    <form onSubmit={keepForm(action)} className="pin-form">
      <input type="hidden" name="qr" value={qrId} />
      <input
        name="pin"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoComplete="off"
        placeholder="••••"
        aria-label="암호"
        required
        autoFocus
      />
      <button type="submit" disabled={pending}>
        {pending ? '확인 중…' : '열기'}
      </button>
      <Msg s={state} />
    </form>
  )
}

export function ActivateForm({ qrId }: { qrId: string }) {
  const [state, action, pending] = useActionState(activateAction, initial)
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const code = digits.join('')

  function put(i: number, raw: string) {
    const v = raw.replace(/\D/g, '')
    if (v.length > 1) {
      // 붙여넣기
      const next = [...digits]
      v.slice(0, 6 - i)
        .split('')
        .forEach((c, k) => (next[i + k] = c))
      setDigits(next)
      boxes.current[Math.min(5, i + v.length)]?.focus()
      return
    }
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < 5) boxes.current[i + 1]?.focus()
  }

  return (
    <form onSubmit={keepForm(action)} className="act-form">
      <input type="hidden" name="qr" value={qrId} />
      <input type="hidden" name="code" value={code} />
      <div className="act-boxes" role="group" aria-label="6자리 코드">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el
            }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            aria-label={`${i + 1}번째 숫자`}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus()
            }}
          />
        ))}
      </div>
      <button type="submit" disabled={pending || code.length !== 6}>
        {pending ? '여는 중…' : '문 열기'}
      </button>
      <Msg s={state} />
    </form>
  )
}
