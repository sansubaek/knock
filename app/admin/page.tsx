import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

async function count(table: string, filter?: (q: any) => any) {
  const db = createAdminClient()
  let q = db.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count } = await q
  return count ?? 0
}

export default async function AdminHome() {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const [members, beta, newOrders, active, issued, openInq, scans7, lost] = await Promise.all([
    count('profiles'),
    count('orders', (q) => q.eq('kind', 'beta')),
    count('orders', (q) => q.eq('status', 'received')),
    count('qr_codes', (q) => q.eq('status', 'active')),
    count('qr_codes', (q) => q.in('status', ['issued', 'printed'])),
    count('inquiries', (q) => q.eq('status', 'open')),
    count('scan_logs', (q) => q.gte('scanned_at', since).eq('is_owner', false)),
    count('qr_codes', (q) => q.eq('lost_mode', true)),
  ])
  const db = createAdminClient()
  const { data: logs } = await db.from('admin_logs').select('action, target, created_at').order('created_at', { ascending: false }).limit(15)

  const cards: [string, number, string][] = [
    ['회원', members, '/admin/members'],
    ['베타 신청', beta, '/admin/orders'],
    ['새 신청 (접수)', newOrders, '/admin/orders?status=received'],
    ['활성 케이스', active, '/admin/qr?status=active'],
    ['미등록 QR', issued, '/admin/qr'],
    ['답 안 한 문의', openInq, '/admin/inquiries'],
    ['최근 7일 스캔', scans7, '/admin'],
    ['분실 모드 켜짐', lost, '/admin/qr?status=lost'],
  ]
  return (
    <>
      <h1 className="adm-h">한눈에 보기</h1>
      <div className="adm-cards">
        {cards.map(([label, n, href]) => (
          <Link key={label} href={href} className="adm-card">
            <b>{n.toLocaleString()}</b>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <h2 className="adm-h2">최근 관리자 작업</h2>
      <table className="adm-table">
        <tbody>
          {(logs ?? []).map((l, i) => (
            <tr key={i}>
              <td className="mono small">{l.created_at.slice(0, 16).replace('T', ' ')}</td>
              <td>{l.action}</td>
              <td className="mono small">{l.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
