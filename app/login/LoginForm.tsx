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
          ? '가입 확인 메일의 링크를 먼저 눌러주세요.'
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
    setMode('sent')
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
        <div className="auth-sent">
          <b>메일을 보냈어요</b>
          <p>
            {email}로 온 메일의 버튼을 누르면 새 창에서 비밀번호를 만드는 화면이 열려요. 이 창은 닫아도 돼요.
          </p>
          <p className="auth-fine">링크는 1시간 안에 한 번만 쓸 수 있어요. 메일이 안 보이면 스팸함도 확인해 주세요.</p>
        </div>
        <button type="button" className="link-btn" onClick={() => setMode('login')}>
          로그인으로 돌아가기
        </button>
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
          <p className="auth-p">가입한 이메일을 적으면 비밀번호를 새로 만드는 링크를 보내드려요.</p>
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="me@example.com" />
          <button type="submit" disabled={busy}>
            {busy ? '보내는 중…' : '링크 받기'}
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
