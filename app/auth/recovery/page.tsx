import type { Metadata } from 'next'
import { Recovery } from './Recovery'

export const metadata: Metadata = { title: '비밀번호 다시 만들기 · knock', robots: { index: false } }

export default function RecoveryPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <a className="auth-logo" href="/">
          knock
        </a>
        <Recovery />
      </div>
    </div>
  )
}
