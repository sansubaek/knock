import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PasswordForm } from './PasswordForm'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = { title: '비밀번호 만들기 · knock' }

export default async function PasswordPage() {
  const { user } = await getSession()
  if (!user) redirect('/login?next=/account/password')
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <a className="auth-logo" href="/">
          knock
        </a>
        <h1>비밀번호 만들기</h1>
        <p className="auth-p">{user.email} 계정에서 쓸 새 비밀번호를 정해주세요. 다음부터는 이메일과 이 비밀번호로 로그인해요.</p>
        <PasswordForm />
      </div>
    </div>
  )
}
