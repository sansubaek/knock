import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminMembers({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
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
  ;(qrs ?? []).forEach((q) => qcount.set(q.owner_id, (qcount.get(q.owner_id) ?? 0) + 1))

  return (
    <>
      <h1 className="adm-h">회원</h1>
      <p className="mute">관리자 지정·해제는 보안을 위해 Supabase SQL Editor에서만 해요. (가이드 3번)</p>
      <table className="adm-table">
        <thead>
          <tr>
            <th>이메일</th>
            <th>닉네임</th>
            <th>권한</th>
            <th>케이스</th>
            <th>가입</th>
            <th>마지막 로그인</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const p = pmap.get(u.id)
            return (
              <tr key={u.id}>
                <td>{u.email ?? u.app_metadata?.provider}</td>
                <td>
                  {p?.nickname ?? '-'}
                  {!p?.is_over_14 && <span className="pill">설정 전</span>}
                </td>
                <td>{p?.role === 'admin' ? <span className="pill warn">관리자</span> : '회원'}</td>
                <td>{qcount.get(u.id) ?? 0}</td>
                <td className="small">{u.created_at?.slice(0, 10)}</td>
                <td className="small">{u.last_sign_in_at?.slice(0, 10) ?? '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="adm-row">
        {page > 1 && <a href={`/admin/members?page=${page - 1}`}>← 이전</a>}
        {users.length === 100 && <a href={`/admin/members?page=${page + 1}`}>다음 →</a>}
      </div>
    </>
  )
}
