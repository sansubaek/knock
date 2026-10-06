'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/browser'

export function PasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const supabase = getBrowserClient()

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (password.length < 8) return setMsg({ ok: false, text: '비밀번호는 8자 이상으로 만들어주세요.' })
    if (password !== password2) return setMsg({ ok: false, text: '비밀번호 두 칸이 서로 달라요.' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      return setMsg({
        ok: false,
        text: /same|different/i.test(error.message) ? '지금 쓰는 비밀번호와 다른 걸로 해주세요.' : '저장하지 못했어요. 다시 해주세요.',
      })
    }
    setMsg({ ok: true, text: '저장했어요. 내 knock으로 이동할게요.' })
    setTimeout(() => {
      router.replace('/my')
      router.refresh()
    }, 900)
  }

  return (
    <form onSubmit={save} className="auth-form">
      <label htmlFor="password">새 비밀번호 (8자 이상)</label>
      <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label htmlFor="password2">한 번 더</label>
      <input id="password2" type="password" required minLength={8} autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
      <button type="submit" disabled={busy}>
        {busy ? '저장 중…' : '비밀번호 저장'}
      </button>
      {msg && <p className={`v-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
    </form>
  )
}
