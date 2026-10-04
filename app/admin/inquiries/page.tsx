import { replyInquiry } from '../actions'
import { createAdminClient } from '@/lib/supabase/admin'

const TYPE: Record<string, string> = { general: '일반', code: '코드 재발급', report: '신고', lost: '주운 케이스', other: '기타' }

export default async function AdminInquiries({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams
  const db = createAdminClient()
  let q = db.from('inquiries').select('*').order('created_at', { ascending: false }).limit(200)
  if (!all) q = q.eq('status', 'open')
  const { data: list } = await q
  return (
    <>
      <div className="adm-row">
        <h1 className="adm-h">문의</h1>
        <nav className="adm-filter">
          <a href="/admin/inquiries">답 안 한 것</a>
          <a href="/admin/inquiries?all=1">전체</a>
        </nav>
      </div>
      <p className="mute">
        답변을 저장하면 로그인한 회원은 &lsquo;내 knock&rsquo;에서 볼 수 있어요. 아직 메일 자동 발송은 없으니, 비회원 문의는 이메일 주소로 직접 답장해 주세요.
      </p>
      <div className="order-list">
        {(list ?? []).length === 0 && <p className="mute">새 문의가 없어요.</p>}
        {(list ?? []).map((i) => (
          <article key={i.id} className="order">
            <div className="order-head">
              <span className="pill">{TYPE[i.type] ?? i.type}</span>
              <a href={`mailto:${i.email}?subject=${encodeURIComponent('[knock] 문의 답변')}`}>{i.email}</a>
              {i.target_id && (
                <a className="mono small" href={`/admin/qr?status=`} title="QR 목록에서 찾기">
                  {i.target_id}
                </a>
              )}
              <span className="mute small">{i.created_at.slice(0, 16).replace('T', ' ')}</span>
            </div>
            <p className="pre">{i.body}</p>
            <form action={replyInquiry} className="adm-form col">
              <input type="hidden" name="id" value={i.id} />
              <textarea name="reply" rows={3} defaultValue={i.reply ?? ''} placeholder="답변" aria-label="답변" />
              <div className="adm-form">
                <select name="status" defaultValue={i.status === 'open' ? 'answered' : i.status} aria-label="상태">
                  <option value="open">답변 전</option>
                  <option value="answered">답변 완료</option>
                  <option value="closed">종료</option>
                </select>
                <button className="btn-s solid" type="submit">
                  저장
                </button>
              </div>
            </form>
          </article>
        ))}
      </div>
    </>
  )
}
