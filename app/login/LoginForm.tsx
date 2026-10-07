'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getBrowserClient, sendRecoveryMail } from '@/lib/supabase/browser'

export function LoginForm({ next, kakao }: { next: string; kakao: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'reset' | 'sent'>('login')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [code, setCode] = useState('')
  const supabase = getBrowserClient()

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setMsg({
        ok: false,
        text: /confirm/i.test(error.message)
          ? '가입 확인이 아직 안 끝났어요. 회원가입 화면에서 메일로 받은 코드를 넣어주세요.'
          : '이메일이나 비밀번호가 맞지 않아요. 비밀번호를 만든 적이 없다면 아래 "비밀번호 찾기"로 새로 만들어주세요.',
      })
      return
    }
    router.replace(next)
    router.refresh()
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await sendRecoveryMail(email.trim())
    setBusy(false)
    if (error) {
      setMsg({
        ok: false,
        text: /rate|seconds/i.test(error.message) ? '메일을 너무 자주 보냈어요. 잠시 뒤에 다시 해주세요.' : '메일을 보내지 못했어요. 주소를 확인해 주세요.',
      })
      return
    }
    setCode('')
    setMode('sent')
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return setMsg({ ok: false, text: '메일에 온 숫자 코드를 그대로 넣어주세요.' })
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'recovery' })
    setBusy(false)
    if (error) {
      setMsg({ ok: false, text: /expired|invalid/i.test(error.message) ? '코드가 맞지 않거나 시간이 지났어요. 가장 최근 메일의 코드를 넣어주세요.' : '확인하지 못했어요. 잠시 뒤에 다시 해주세요.' })
      return
    }
    window.location.replace('/account/password')
  }

  async function withKakao() {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

  const signupHref = `/signup${next !== '/my' ? `?next=${encodeURIComponent(next)}` : ''}`

  if (mode === 'sent') {
    return (
      <div className="auth-forms">
        <form onSubmit={checkCode} className="auth-form">
          <p className="auth-p">
            <b>{email}</b>로 숫자 코드를 보냈어요. 메일에 있는 코드를 넣으면 비밀번호를 새로 만들 수 있어요.
          </p>
          <label htmlFor="code">메일로 받은 코드</label>
          <input
            id="code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="숫자 6자리"
          />
          <button type="submit" disabled={busy}>
            {busy ? '확인 중…' : '확인'}
          </button>
        </form>
        {msg && <p className={`v-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
        <p className="auth-fine">코드는 1시간 동안 쓸 수 있어요. 메일이 안 보이면 스팸함도 확인해 주세요. 메일 속 버튼을 눌러도 돼요.</p>
        <div className="auth-links">
          <button type="button" className="link-btn" onClick={() => { setMode('reset'); setMsg(null) }}>
            메일 다시 받기
          </button>
          <button type="button" className="link-btn" onClick={() => { setMode('login'); setMsg(null) }}>
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-forms">
      {kakao && mode === 'login' && (
        <>
          <button type="button" className="kakao-btn" onClick={withKakao}>
            카카오로 시작하기
          </button>
          <p className="auth-or">또는 이메일로</p>
        </>
      )}

      {mode === 'login' ? (
        <form onSubmit={login} className="auth-form">
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="me@example.com" />
          <label htmlFor="password">비밀번호</label>
          <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={busy}>
            {busy ? '확인 중…' : '로그인'}
          </button>
        </form>
      ) : (
        <form onSubmit={sendReset} className="auth-form">
          <p className="auth-p">가입한 이메일을 적으면 비밀번호를 새로 만드는 숫자 코드를 보내드려요.</p>
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="me@example.com" />
          <button type="submit" disabled={busy}>
            {busy ? '보내는 중…' : '코드 받기'}
          </button>
          <button type="button" className="link-btn" onClick={() => { if (!email.trim()) { setMsg({ ok: false, text: '이메일을 먼저 적어주세요.' }); return } setCode(''); setMsg(null); setMode('sent') }}>
            이미 받은 코드가 있어요
          </button>
        </form>
      )}

      {msg && <p className={`v-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}

      <div className="auth-links">
        {mode === 'login' ? (
          <>
            <button type="button" className="link-btn" onClick={() => { setMode('reset'); setMsg(null) }}>
              비밀번호 찾기
            </button>
            <a href={signupHref}>회원가입</a>
          </>
        ) : (
          <button type="button" className="link-btn" onClick={() => { setMode('login'); setMsg(null) }}>
            로그인으로 돌아가기
          </button>
        )}
      </div>
    </div>
  )
}
