import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { kst } from '@/lib/admin-format'
import { replyInquiry } from '../actions'
import { Badge, Empty, PageHead, Tabs } from '../ui'

const TYPE: Record<string, string> = { general: '일반', code: '코드 재발급', report: '신고', lost: '주운 케이스', other: '기타' }
const TYPE_TONE: Record<string, string> = { general: 'gray', code: 'blue', report: 'red', lost: 'purple', other: 'gray' }
const STATUS: Record<string, [string, string]> = { open: ['답변 전', 'red'], answered: ['답변 완료', 'green'], closed: ['종료', 'gray'] }

export default async function AdminInquiries({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireAdmin()
  const { all } = await searchParams
  const db = createAdminClient()
  const { data: every } = await db.from('inquiries').select('status').limit(5000)
  const openCount = (every ?? []).filter((i) => i.status === 'open').length

  let q = db.from('inquiries').select('*').order('created_at', { ascending: false }).limit(200)
  if (!all) q = q.eq('status', 'open')
  const { data } = await q
  const list = data ?? []

  return (
    <>
      <PageHead
        title="문의"
        desc="답변을 저장하면 회원은 '내 knock'에서 볼 수 있어요. 메일 자동 발송은 아직 없어서, 비회원은 이메일 주소를 눌러 직접 답장해 주세요."
      />
      <div className="ad-listbar">
        <Tabs
          current={all ? 'all' : 'open'}
          items={[
            { key: 'open', label: '답 안 한 것', href: '/admin/inquiries', count: openCount },
            { key: 'all', label: '전체', href: '/admin/inquiries?all=1', count: (every ?? []).length },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <div className="ad-card">
          <Empty title={all ? '아직 문의가 없어요' : '답할 문의가 없어요'} />
        </div>
      ) : (
        <div className="ad-stack">
          {list.map((i) => {
            const [sLabel, sTone] = STATUS[i.status] ?? [i.status, 'gray']
            return (
              <article key={i.id} className="ad-card ad-inq">
                <div className="ad-order-top">
                  <div className="ad-badges">
                    <Badge tone={TYPE_TONE[i.type] ?? 'gray'}>{TYPE[i.type] ?? i.type}</Badge>
                    <a className="ad-link" href={`mailto:${i.email}?subject=${encodeURIComponent('[knock] 문의 답변')}`}>
                      {i.email}
                    </a>
                    {i.target_id && (
                      <a className="ad-id" href={`/admin/qr?q=${encodeURIComponent(i.target_id)}`} title="QR 목록에서 보기">
                        {i.target_id}
                      </a>
                    )}
                    <span className="ad-sub">{kst(i.created_at)}</span>
                  </div>
                  <Badge tone={sTone}>{sLabel}</Badge>
                </div>
                <blockquote className="ad-quote">{i.body}</blockquote>
                <form action={replyInquiry} className="ad-form col">
                  <input type="hidden" name="id" value={i.id} />
                  <label className="ad-field">
                    <span>답변</span>
                    <textarea className="ad-input" name="reply" rows={3} defaultValue={i.reply ?? ''} placeholder="고객에게 보일 답변을 적어주세요" />
                  </label>
                  <div className="ad-form">
                    <select className="ad-input" name="status" defaultValue={i.status === 'open' ? 'answered' : i.status} aria-label="상태">
                      <option value="open">답변 전</option>
                      <option value="answered">답변 완료</option>
                      <option value="closed">종료</option>
                    </select>
                    <button className="ad-btn primary" type="submit">
                      답변 저장
                    </button>
                  </div>
                </form>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
