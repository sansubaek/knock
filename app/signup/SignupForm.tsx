'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/browser'

export function SignupForm({ next, kakao }: { next: string; kakao: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const supabase = getBrowserClient()

  async function signup(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (password.length < 8) return setMsg('비밀번호는 8자 이상으로 만들어주세요.')
    if (password !== password2) return setMsg('비밀번호 두 칸이 서로 달라요.')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    setBusy(false)
    if (error) {
      if (/registered|exists/i.test(error.message)) return setMsg('이미 가입된 이메일이에요. 로그인해 주세요.')
      if (/password/i.test(error.message)) return setMsg('비밀번호가 너무 쉬워요. 다른 비밀번호로 해주세요.')
      if (/rate|seconds/i.test(error.message)) return setMsg('잠시 뒤에 다시 해주세요.')
      return setMsg('가입하지 못했어요. 이메일 주소를 확인해 주세요.')
    }
    // 이미 가입된 주소면 Supabase가 오류 대신 빈 identities를 돌려줌
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return setMsg('이미 가입된 이메일이에요. 로그인해 주세요.')
    }
    if (data.session) {
      // 가입 확인 메일을 쓰지 않는 설정: 바로 로그인됨 → 첫 설정(닉네임, 만 14세)으로
      router.replace(next)
      router.refresh()
      return
    }
    setSent(true)
  }

  async function withKakao() {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

  const loginHref = `/login${next !== '/my' ? `?next=${encodeURIComponent(next)}` : ''}`

  if (sent) {
    return (
      <div className="auth-forms">
        <div className="auth-sent">
          <b>가입 확인 메일을 보냈어요</b>
          <p>{email}로 온 메일의 버튼을 누르면 가입이 끝나고 바로 시작할 수 있어요. 이 창은 닫아도 돼요.</p>
          <p className="auth-fine">메일이 안 보이면 스팸함도 확인해 주세요.</p>
        </div>
        <a className="auth-alt" href={loginHref}>
          로그인 화면으로
        </a>
      </div>
    )
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
      <form onSubmit={signup} className="auth-form">
        <label htmlFor="email">이메일</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="me@example.com" />
        <label htmlFor="password">비밀번호 (8자 이상)</label>
        <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label htmlFor="password2">비밀번호 한 번 더</label>
        <input id="password2" type="password" required minLength={8} autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
        <button type="submit" disabled={busy}>
          {busy ? '가입하는 중…' : '가입하기'}
        </button>
      </form>
      {msg && <p className="v-msg err">{msg}</p>}
      <div className="auth-links">
        <span>이미 계정이 있나요?</span>
        <a href={loginHref}>로그인</a>
      </div>
      <p className="auth-fine">
        가입하면 <a href="/terms">이용약관</a>과 <a href="/privacy">개인정보처리방침</a>에 동의하게 돼요. 다음 화면에서 닉네임과 나이를 확인해요.
      </p>
    </div>
  )
}
