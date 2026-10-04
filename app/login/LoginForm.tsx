'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/browser'

export function LoginForm({ next, kakao }: { next: string; kakao: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const supabase = getBrowserClient()

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setBusy(false)
    if (error) {
      setMsg({
        ok: false,
        text: /rate|seconds/i.test(error.message) ? '메일을 너무 자주 보냈어요. 1분 뒤에 다시 해주세요.' : '메일을 보내지 못했어요. 주소를 확인해 주세요.',
      })
      return
    }
    setStep('code')
    setMsg({ ok: true, text: '메일을 보냈어요. 메일의 숫자를 넣거나, 메일 속 버튼을 눌러주세요.' })
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })
    setBusy(false)
    if (error) {
      setMsg({ ok: false, text: '숫자가 맞지 않거나 시간이 지났어요. 다시 받아주세요.' })
      return
    }
    router.replace(next)
    router.refresh()
  }

  async function withKakao() {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

  return (
    <div className="auth-forms">
      {kakao && (
        <>
          <button type="button" className="kakao-btn" onClick={withKakao}>
            카카오로 시작하기
          </button>
          <p className="auth-or">또는 이메일로</p>
        </>
      )}
      {step === 'email' ? (
        <form onSubmit={sendEmail} className="auth-form">
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="me@example.com" />
          <button type="submit" disabled={busy}>
            {busy ? '보내는 중…' : '로그인 메일 받기'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="auth-form">
          <label htmlFor="token">{email}로 온 숫자</label>
          <input
            id="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,8}"
            maxLength={8}
            required
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
          />
          <button type="submit" disabled={busy}>
            {busy ? '확인 중…' : '로그인'}
          </button>
          <button type="button" className="link-btn" onClick={() => setStep('email')}>
            이메일 다시 입력
          </button>
        </form>
      )}
      {msg && <p className={`v-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      <p className="auth-fine">
        로그인하면 <a href="/terms">이용약관</a>과 <a href="/privacy">개인정보처리방침</a>에 동의하게 돼요.
      </p>
    </div>
  )
}
