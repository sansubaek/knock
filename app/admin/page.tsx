import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ago, describeLog, kst, ORDER_STATUS } from '@/lib/admin-format'
import { PageHead } from './ui'

async function count(table: string, filter?: (q: any) => any) {
  const db = createAdminClient()
  let q = db.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count } = await q
  return count ?? 0
}

const FLOW = ['received', 'requested', 'producing', 'shipped', 'activated'] as const

export default async function AdminHome() {
  const { profile } = await requireAdmin()
  const now = new Date()
  const since = new Date(now.getTime() - 7 * 86400_000).toISOString()
  const db = createAdminClient()
  const [members, active, stock, openInq, scans7, lost, locked, orderRows, logsRes] = await Promise.all([
    count('profiles'),
    count('qr_codes', (q) => q.eq('status', 'active')),
    count('qr_codes', (q) => q.in('status', ['issued', 'printed'])),
    count('inquiries', (q) => q.eq('status', 'open')),
    count('scan_logs', (q) => q.gte('scanned_at', since).eq('is_owner', false)),
    count('qr_codes', (q) => q.eq('lost_mode', true)),
    count('qr_codes', (q) => q.gt('locked_until', now.toISOString())),
    db.from('orders').select('status, kind').limit(2000),
    db.from('admin_logs').select('action, target, created_at').order('created_at', { ascending: false }).limit(12),
  ])
  const orders = orderRows.data ?? []
  const byStatus = (s: string) => orders.filter((o) => o.status === s).length
  const beta = orders.filter((o) => o.kind === 'beta').length
  const received = byStatus('received')
  const logs = logsRes.data ?? []
  const [mm, dd] = kst(now.toISOString()).slice(0, 5).split('.')
  const today = `${Number(mm)}월 ${Number(dd)}일`

  const todos: { tone: string; text: string; href: string; cta: string }[] = []
  if (received) todos.push({ tone: 'red', text: `새 신청 ${received}건이 접수 상태예요`, href: '/admin/orders?status=received', cta: '확인하기' })
  if (openInq) todos.push({ tone: 'orange', text: `답하지 않은 문의가 ${openInq}건 있어요`, href: '/admin/inquiries', cta: '답하기' })
  if (lost) todos.push({ tone: 'purple', text: `분실 모드가 켜진 케이스가 ${lost}개 있어요`, href: '/admin/qr?status=lost', cta: '보기' })
  if (locked) todos.push({ tone: 'gray', text: `코드를 여러 번 틀려 잠긴 QR이 ${locked}개 있어요 (15분 뒤 자동 해제)`, href: '/admin/qr', cta: '보기' })

  const stats: { label: string; value: number; sub: string; href: string }[] = [
    { label: '회원', value: members, sub: '가입한 사람', href: '/admin/members' },
    { label: '사용 중인 케이스', value: active, sub: '코드 등록까지 끝난 케이스', href: '/admin/qr?status=active' },
    { label: 'QR 재고', value: stock, sub: '발급했지만 아직 등록 전', href: '/admin/qr' },
    { label: '최근 7일 스캔', value: scans7, sub: '주인 말고 다른 사람이 찍은 수', href: '/admin/qr?status=active' },
    { label: '베타 신청', value: beta, sub: '지금까지 받은 신청', href: '/admin/orders' },
  ]

  return (
    <>
      <PageHead title={`안녕하세요, ${profile.nickname ?? '관리자'}님`} desc={`${today} 기준 knock 현황이에요.`} />

      <div className="ad-stack">
        <section className="ad-card">
          <h2 className="ad-card-h">지금 할 일</h2>
          {todos.length === 0 ? (
            <p className="ad-calm">처리할 일이 없어요. 새 신청이나 문의가 오면 여기에 떠요.</p>
          ) : (
            <ul className="ad-todo">
              {todos.map((t) => (
                <li key={t.text}>
                  <Link href={t.href}>
                    <i className={`ad-dot ${t.tone}`} />
                    <span>{t.text}</span>
                    <b>{t.cta} →</b>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ad-stats">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="ad-stat">
              <span className="ad-stat-l">{s.label}</span>
              <b className="ad-stat-n">{s.value.toLocaleString()}</b>
              <span className="ad-stat-s">{s.sub}</span>
            </Link>
          ))}
        </section>

        <section className="ad-card">
          <h2 className="ad-card-h">
            주문 흐름
            <Link href="/admin/orders" className="ad-more">
              전체 보기
            </Link>
          </h2>
          <ol className="ad-flow">
            {FLOW.map((s) => (
              <li key={s}>
                <Link href={`/admin/orders?status=${s}`}>
                  <b>{byStatus(s)}</b>
                  <span>{ORDER_STATUS[s]}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="ad-hint">접수 → QR 발급(자동으로 제작 요청) → 업체 제작 → 발송 → 고객이 코드를 넣으면 활성화 완료</p>
        </section>

        <section className="ad-card">
          <h2 className="ad-card-h">최근 작업 기록</h2>
          {logs.length === 0 ? (
            <p className="ad-calm">아직 기록이 없어요.</p>
          ) : (
            <ul className="ad-log">
              {logs.map((l, i) => (
                <li key={i}>
                  <span>{describeLog(l.action, l.target)}</span>
                  <time title={kst(l.created_at)}>{ago(l.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
