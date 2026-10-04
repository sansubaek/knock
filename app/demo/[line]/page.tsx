import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageView, type ViewData } from '@/components/PageView'
import { getTemplate, templatesFor, type Line } from '@/lib/content'

export const metadata: Metadata = { title: '예시 페이지 · knock' }

const SAMPLE: Record<Line, Omit<ViewData, 'template'>> = {
  bang: {
    line: 'bang',
    theme: {},
    guestbook_mode: 'open',
    blocks: [
      { id: '1', type: 'profile', data: { name: '지우', bio: '똑똑, 들어와도 돼\n시험 기간엔 답장 느림' } },
      { id: '2', type: 'mood', data: { emoji: '☁️', text: '중간고사 D-3, 카페인 충전 중' } },
      { id: '3', type: 'music', data: { title: '좋은 날', artist: '아이유' } },
      { id: '4', type: 'link', data: { label: '인스타그램', url: 'https://instagram.com' } },
      { id: '5', type: 'text', data: { text: '이 페이지는 예시예요. 진짜 케이스를 찍으면 주인이 꾸민 방이 열려요.' } },
    ],
    decor: [
      { item: 'star', x: 82, y: 9, rotation: 12, scale: 1, z: 0 },
      { item: 'heart', x: 14, y: 30, rotation: -10, scale: 0.8, z: 1 },
      { item: 'sparkle', x: 88, y: 44, rotation: 0, scale: 0.7, z: 2 },
    ],
    guestbook: [
      { nickname: '민지', message: '케이스 뭐야 너무 귀엽잖아', at: new Date(Date.now() - 86400000).toISOString() },
      { nickname: '익명', message: '도서관에서 찍고 감 ㅋㅋ', at: new Date(Date.now() - 3 * 86400000).toISOString() },
    ],
    knock_count: 27,
    today_visits: 4,
    total_visits: 112,
  },
  dot: {
    line: 'dot',
    theme: {},
    guestbook_mode: 'off',
    blocks: [
      { id: '1', type: 'card', data: { name: '주건우', title: 'Founder', org: 'knock', email: 'hello.knock.team@gmail.com', website: 'https://knock-sansubaek.vercel.app' } },
      { id: '2', type: 'text', data: { text: '케이스를 찍으면 명함이 저장됩니다.\n종이 명함 대신 knock.' } },
      { id: '3', type: 'career', data: { lines: '2026 — knock 창업\n2026 — 모두의창업 선정\n인하대학교' } },
      { id: '4', type: 'link', data: { label: '포트폴리오', url: 'https://knock-sansubaek.vercel.app' } },
    ],
    decor: [],
    guestbook: [],
    knock_count: 0,
    today_visits: 0,
    total_visits: 0,
  },
}

export default async function Demo({ params, searchParams }: { params: Promise<{ line: string }>; searchParams: Promise<{ t?: string }> }) {
  const { line } = await params
  const { t } = await searchParams
  if (line !== 'bang' && line !== 'dot') notFound()
  const tpl = getTemplate(line, t)
  return (
    <PageView
      data={{ ...SAMPLE[line], template: tpl.key }}
      preview
      banner={
        <div className="demo-bar">
          <span>예시 페이지</span>
          <nav>
            {templatesFor(line).map((x) => (
              <Link key={x.key} href={`/demo/${line}?t=${x.key}`} aria-current={x.key === tpl.key ? 'page' : undefined}>
                {x.name}
              </Link>
            ))}
          </nav>
        </div>
      }
    />
  )
}
