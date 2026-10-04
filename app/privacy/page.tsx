import type { Metadata } from 'next'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Markdown } from '@/lib/markdown'

export const metadata: Metadata = { title: '개인정보처리방침 · knock' }
export const dynamic = 'force-static'

export default function Page() {
  const source = readFileSync(path.join(process.cwd(), 'content', 'privacy.md'), 'utf8')
  return (
    <div className="plain">
      <div className="plain-col doc">
        <a className="auth-logo" href="/">
          knock
        </a>
        <Markdown source={source} />
      </div>
    </div>
  )
}
