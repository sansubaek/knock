import type { Metadata } from 'next'
import { SupportForm } from './SupportForm'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = { title: '문의 · knock' }

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ type?: string; target?: string }> }) {
  const sp = await searchParams
  const { user } = await getSession()
  return (
    <div className="plain">
      <div className="plain-col">
        <a className="auth-logo" href="/">
          knock
        </a>
        <h1>문의 · 신고</h1>
        <p className="auth-p">코드 재발급, 주운 케이스 신고, 불쾌한 페이지 신고, 그 밖의 궁금한 점을 남겨주세요.</p>
        <SupportForm type={sp.type ?? 'general'} target={sp.target ?? ''} email={user?.email ?? ''} />
      </div>
    </div>
  )
}
