import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { kst, lineName, ORDER_STATUS, ORDER_TONE } from '@/lib/admin-format'
import { OrderIssue } from '../IssueForms'
import { updateOrder } from '../actions'
import { Badge, Empty, PageHead, Tabs } from '../ui'

const KIND: Record<string, string> = { beta: '베타', preorder: '사전예약', order: '주문' }

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const { status = 'all' } = await searchParams
  const db = createAdminClient()
  const { data: all } = await db.from('orders').select('status').limit(5000)
  const cnt = (s: string) => (all ?? []).filter((o) => o.status === s).length

  let q = db.from('orders').select('*').order('created_at', { ascending: false }).limit(300)
  if (ORDER_STATUS[status]) q = q.eq('status', status)
  const { data: orders } = await q
  const list = orders ?? []

  return (
    <>
      <PageHead
        title="신청 · 주문"
        desc="베타 신청과 주문을 보고 진행 상태를 바꿔요. 접수된 건에 'QR 발급'을 누르면 자동으로 제작 요청 상태가 돼요."
      />

      <div className="ad-listbar">
        <Tabs
          current={status}
          items={[
            { key: 'all', label: '전체', href: '/admin/orders', count: (all ?? []).length },
            ...Object.entries(ORDER_STATUS).map(([k, v]) => ({ key: k, label: v, href: `/admin/orders?status=${k}`, count: cnt(k) })),
          ]}
        />
      </div>

      {list.length === 0 ? (
        <div className="ad-card">
          <Empty title={status === 'all' ? '아직 신청이 없어요' : `'${ORDER_STATUS[status]}' 상태인 건이 없어요`}>
            베타 신청 페이지(/beta)로 들어온 신청이 여기에 쌓여요.
          </Empty>
        </div>
      ) : (
        <div className="ad-stack">
          {list.map((o) => (
            <article key={o.id} className="ad-card ad-order">
              <div className="ad-order-top">
                <div>
                  <div className="ad-order-name">
                    {o.applicant_name}
                    <Badge tone="gray">{KIND[o.kind] ?? o.kind}</Badge>
                    <Badge tone={o.line === 'dot' ? 'gray' : 'blue'}>{lineName(o.line)}</Badge>
                  </div>
                  <dl className="ad-meta">
                    <div>
                      <dt>연락처</dt>
                      <dd>{o.contact}</dd>
                    </div>
                    <div>
                      <dt>디자인</dt>
                      <dd>{o.design ?? '-'}</dd>
                    </div>
                    <div>
                      <dt>기종</dt>
                      <dd>{o.phone_model ?? '-'}</dd>
                    </div>
                    <div>
                      <dt>신청</dt>
                      <dd>{kst(o.created_at)}</dd>
                    </div>
                  </dl>
                </div>
                <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS[o.status] ?? o.status}</Badge>
              </div>

              <form action={updateOrder} className="ad-form ad-order-form">
                <input type="hidden" name="order" value={o.id} />
                <label className="ad-field">
                  <span>상태</span>
                  <select className="ad-input" name="status" defaultValue={o.status}>
                    {Object.entries(ORDER_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ad-field grow">
                  <span>메모 (송장번호, 특이사항)</span>
                  <input className="ad-input" name="memo" defaultValue={o.admin_memo ?? ''} placeholder="예: CJ 1234-5678" />
                </label>
                <button className="ad-btn primary" type="submit">
                  저장
                </button>
              </form>
              {o.status !== 'canceled' && <OrderIssue orderId={o.id} />}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
