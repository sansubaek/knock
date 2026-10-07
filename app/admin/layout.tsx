import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminNav } from './AdminNav'
import { VOTE_OPEN } from '@/lib/vote'
import './admin.css'

export const metadata: Metadata = { title: '관리자 · knock', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireAdmin()
  const db = createAdminClient()
  const [{ count: newOrders }, { count: openInq }, { count: votes }] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'received'),
    db.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('theme_votes').select('id', { count: 'exact', head: true }),
  ])

  return (
    <div className="ad">
      <aside className="ad-side">
        <Link href="/admin" className="ad-brand">
          knock<small>관리자</small>
        </Link>
        <AdminNav
          items={[
            { href: '/admin', label: '홈' },
            { href: '/admin/orders', label: '신청 · 주문', count: newOrders ?? 0 },
            { href: '/admin/qr', label: 'QR 발급 · 관리' },
            { href: '/admin/inquiries', label: '문의', count: openInq ?? 0 },
            { href: '/admin/members', label: '회원' },
            ...(VOTE_OPEN || votes ? [{ href: '/admin/votes', label: '테마 투표' }] : []),
          ]}
        />
        <div className="ad-side-foot">
          <Link href="/my">← 내 knock으로</Link>
          <a href="/" target="_blank" rel="noreferrer">
            사이트 열기 ↗
          </a>
          <span title={user.email ?? ''}>{profile.nickname ?? user.email}</span>
        </div>
      </aside>
      <main className="ad-main">{children}</main>
    </div>
  )
}
