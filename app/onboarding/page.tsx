import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './OnboardingForm'
import { getSession, safeNext } from '@/lib/auth'

export const metadata: Metadata = { title: '처음 설정 · knock' }

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  const { user, profile } = await getSession()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/onboarding?next=${next}`)}`)
  if (profile?.is_over_14) redirect(next)
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <a className="auth-logo" href="/">
          knock
        </a>
        <h1>반가워요!</h1>
        <p className="auth-p">딱 두 가지만 정하면 시작할 수 있어요.</p>
        <OnboardingForm next={next} />
      </div>
    </div>
  )
}
