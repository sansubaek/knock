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
        {sp.error && (
          <p className="v-msg err">메일 속 링크가 만료됐거나 다른 브라우저에서 열렸어요. 메일을 요청한 폰·브라우저에서 다시 해주세요.</p>
        )}
        <LoginForm next={next} kakao={KAKAO_LOGIN} />
      </div>
    </div>
  )
}
