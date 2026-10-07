import type { Metadata } from 'next'
import { VOTE_OPEN } from '@/lib/vote'
import { myVotes } from '@/lib/vote-server'
import { VoteClient } from './VoteClient'
import './vote.css'

export const metadata: Metadata = {
  title: '테마 투표 · knock',
  description: '케이스 QR을 찍으면 열리는 페이지 디자인, 1위부터 5위까지 골라주세요.',
}
export const dynamic = 'force-dynamic'

export default async function VotePage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const sp = await searchParams
  if (!VOTE_OPEN) {
    return (
      <div className="plain">
        <div className="plain-col">
          <a className="auth-logo" href="/">
            knock
          </a>
          <h1>테마 투표가 끝났어요</h1>
          <p className="auth-p">참여해 주셔서 고마워요. 고른 테마는 정식 출시 때 만나요.</p>
        </div>
      </div>
    )
  }
  const mine = await myVotes()
  return <VoteClient initial={mine} startLine={sp.line === 'dot' ? 'dot' : 'bang'} />
}
