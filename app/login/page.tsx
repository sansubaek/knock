import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from './LoginForm'
import { getSession, safeNext } from '@/lib/auth'
import { KAKAO_LOGIN } from '@/lib/env'

export const metadata: Metadata = { title: '로그인 · knock' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  const { user } = await getSession()
  if (user) redirect(next)
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <a className="auth-logo" href="/">
          knock
        </a>
        <h1>로그인</h1>
        <p className="auth-p">처음이면 자동으로 가입돼요. 비밀번호는 필요 없어요.</p>
        {sp.error && <p className="v-msg err">로그인 링크가 만료됐거나 다른 브라우저에서 열렸어요. 메일의 6자리 숫자로 다시 해주세요.</p>}
        <LoginForm next={next} kakao={KAKAO_LOGIN} />
      </div>
    </div>
  )
}
