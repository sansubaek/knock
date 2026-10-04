import { requireAdmin } from '@/lib/auth'
import { OrderIssue } from '../IssueForms'
import { updateOrder } from '../actions'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS: Record<string, string> = {
  received: '접수',
  requested: '제작 요청',
  producing: '제작 중',
  shipped: '발송',
  activated: '활성화 완료',
  canceled: '취소',
}
const KIND: Record<string, string> = { beta: '베타', preorder: '사전예약', order: '주문' }

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const { status } = await searchParams
  const db = createAdminClient()
  let q = db.from('orders').select('*').order('created_at', { ascending: false }).limit(300)
  if (status && STATUS[status]) q = q.eq('status', status)
  const { data: orders } = await q

  return (
    <>
      <div className="adm-row">
        <h1 className="adm-h">신청 · 주문</h1>
        <nav className="adm-filter">
          <a href="/admin/orders">전체</a>
          {Object.entries(STATUS).map(([k, v]) => (
            <a key={k} href={`/admin/orders?status=${k}`}>
              {v}
            </a>
          ))}
        </nav>
      </div>
      <p className="mute no-print">순서: 접수 → &lsquo;QR 발급&rsquo; 누르기(자동으로 제작 요청) → 인쇄소에 SVG·주문 정보 전달 → 제작 중 → 발송 → 고객이 코드 입력하면 자동으로 활성화 완료.</p>
      <div className="order-list">
        {(orders ?? []).length === 0 && <p className="mute">아직 신청이 없어요.</p>}
        {(orders ?? []).map((o) => (
          <article key={o.id} className="order">
            <div className="order-head">
              <b>{o.applicant_name}</b>
              <span className="pill">{KIND[o.kind]}</span>
              <span>{o.line === 'dot' ? 'knock.' : 'knock!'}</span>
              <span className="mute small">{o.created_at.slice(0, 16).replace('T', ' ')}</span>
            </div>
            <p className="small">
              연락처 {o.contact} · 디자인 {o.design ?? '-'} · 기종 {o.phone_model ?? '-'}
            </p>
            <form action={updateOrder} className="adm-form">
              <input type="hidden" name="order" value={o.id} />
              <select name="status" defaultValue={o.status} aria-label="상태">
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input name="memo" defaultValue={o.admin_memo ?? ''} placeholder="메모 (송장번호 등)" aria-label="메모" />
              <button className="btn-s" type="submit">
                저장
              </button>
            </form>
            {o.status !== 'canceled' && <OrderIssue orderId={o.id} />}
          </article>
        ))}
      </div>
    </>
  )
}
