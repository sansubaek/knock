import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: '관리자 · knock', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="adm">
      <header className="adm-top">
        <Link href="/admin" className="adm-logo">
          knock 관리자
        </Link>
        <nav>
          <Link href="/admin/orders">신청·주문</Link>
          <Link href="/admin/qr">QR 발급</Link>
          <Link href="/admin/inquiries">문의</Link>
          <Link href="/admin/members">회원</Link>
          <Link href="/my">내 knock</Link>
        </nav>
      </header>
      <main className="adm-main">{children}</main>
    </div>
  )
}
