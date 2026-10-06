import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignupForm } from './SignupForm'
import { getSession, safeNext } from '@/lib/auth'
import { KAKAO_LOGIN } from '@/lib/env'

export const metadata: Metadata = { title: '회원가입 · knock' }

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
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
        <h1>회원가입</h1>
        <p className="auth-p">이메일과 비밀번호만 있으면 돼요.</p>
        <SignupForm next={next} kakao={KAKAO_LOGIN} />
      </div>
    </div>
  )
}
