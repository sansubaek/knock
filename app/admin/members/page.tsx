import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { kstDate } from '@/lib/admin-format'
import { Badge, Empty, PageHead } from '../ui'

export default async function AdminMembers({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 80)
  const db = createAdminClient()
  const { data } = await db.auth.admin.listUsers({ page, perPage: 100 })
  const users = data?.users ?? []
  const ids = users.map((u) => u.id)
  const [{ data: profiles }, { data: qrs }] = await Promise.all([
    ids.length ? db.from('profiles').select('id, nickname, role, is_over_14').in('id', ids) : Promise.resolve({ data: [] as { id: string; nickname: string | null; role: string; is_over_14: boolean }[] }),
    ids.length ? db.from('qr_codes').select('owner_id').in('owner_id', ids) : Promise.resolve({ data: [] as { owner_id: string }[] }),
  ])
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const qcount = new Map<string, number>()
  ;(qrs ?? []).forEach((r) => qcount.set(r.owner_id, (qcount.get(r.owner_id) ?? 0) + 1))
  const shown = q
    ? users.filter((u) => (u.email ?? '').toLowerCase().includes(q) || (pmap.get(u.id)?.nickname ?? '').toLowerCase().includes(q))
    : users

  return (
    <>
      <PageHead title="회원" desc="가입한 사람 목록이에요. 관리자 지정·해제는 보안 때문에 이 화면에서는 못 하고, Claude에게 요청하거나 Supabase에서 해요." />

      <div className="ad-listbar">
        <span className="ad-sub">총 {users.length}명{q && ` 중 ${shown.length}명`}</span>
        <form className="ad-search" action="/admin/members">
          <input className="ad-input" name="q" defaultValue={q} placeholder="이메일·닉네임 검색" aria-label="회원 검색" />
        </form>
      </div>

      {shown.length === 0 ? (
        <div className="ad-card">
          <Empty title={q ? `'${q}'에 맞는 회원이 없어요` : '아직 회원이 없어요'} />
        </div>
      ) : (
        <div className="ad-card flush">
          <div className="ad-scroll">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>닉네임</th>
                  <th>이메일</th>
                  <th>권한</th>
                  <th>케이스</th>
                  <th>가입일</th>
                  <th>마지막 로그인</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => {
                  const p = pmap.get(u.id)
                  return (
                    <tr key={u.id}>
                      <td>
                        <b>{p?.nickname ?? '-'}</b>
                        {!p?.is_over_14 && (
                          <>
                            {' '}
                            <Badge tone="orange">첫 설정 전</Badge>
                          </>
                        )}
                      </td>
                      <td className="ad-sub">{u.email ?? u.app_metadata?.provider}</td>
                      <td>{p?.role === 'admin' ? <Badge tone="blue">관리자</Badge> : <Badge>회원</Badge>}</td>
                      <td>{qcount.get(u.id) ?? 0}개</td>
                      <td className="ad-sub">{kstDate(u.created_at)}</td>
                      <td className="ad-sub">{kstDate(u.last_sign_in_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(page > 1 || users.length === 100) && (
        <div className="ad-pager">
          {page > 1 && (
            <a className="ad-btn sm" href={`/admin/members?page=${page - 1}`}>
              ← 이전
            </a>
          )}
          {users.length === 100 && (
            <a className="ad-btn sm" href={`/admin/members?page=${page + 1}`}>
              다음 →
            </a>
          )}
        </div>
      )}
    </>
  )
}
