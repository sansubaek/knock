import type { Metadata } from 'next'
import { BetaForm } from './BetaForm'

export const metadata: Metadata = { title: '베타 신청 · knock' }

export default async function BetaPage({ searchParams }: { searchParams: Promise<{ line?: string; design?: string }> }) {
  const sp = await searchParams
  return (
    <div className="plain">
      <div className="plain-col">
        <a className="auth-logo" href="/">
          knock
        </a>
        <h1>베타 테스터 신청</h1>
        <p className="auth-p">케이스를 받아 2주 동안 써보고 짧은 설문 두 번에 답해주시면 돼요. 정식 출시 소식도 가장 먼저 받아요.</p>
        <BetaForm line={sp.line === 'dot' ? 'dot' : 'bang'} design={sp.design ?? ''} />
      </div>
    </div>
  )
}
