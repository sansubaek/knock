import { BatchIssue, Reissue } from '../IssueForms'
import { markPrinted, setQrStatus } from '../actions'
import { createAdminClient } from '@/lib/supabase/admin'

const LABEL: Record<string, string> = { issued: '발급', printed: '인쇄 넘김', active: '사용 중', retired: '폐기' }

export default async function AdminQr({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams
  const db = createAdminClient()
  let q = db.from('qr_codes').select('id, line, status, lost_mode, owner_id, order_id, created_at, code_used_at, failed_attempts, locked_until').order('created_at', { ascending: false }).limit(300)
  if (status === 'lost') q = q.eq('lost_mode', true)
  else if (status && LABEL[status]) q = q.eq('status', status)
  const { data: qrs } = await q
  const issuedIds = (qrs ?? []).filter((r) => r.status === 'issued').map((r) => r.id)

  return (
    <>
      <h1 className="adm-h">QR 발급</h1>
      <p className="mute no-print">
        발급하면 QR 주소와 6자리 코드가 만들어져요. 코드는 DB에 암호화돼서 저장되고 원래 숫자는 <b>발급 화면에서 한 번만</b> 보여요. CSV를 받아 인쇄소·포장 작업에 쓰고, 다 쓰면 지워주세요.
      </p>
      <section className="adm-sec">
        <h2 className="adm-h2 no-print">새로 발급</h2>
        <BatchIssue />
      </section>
      <section className="adm-sec no-print">
        <h2 className="adm-h2">코드 재발급 (카드 분실, 아직 등록 전인 케이스만)</h2>
        <Reissue />
      </section>
      <section className="adm-sec no-print">
        <div className="adm-row">
          <h2 className="adm-h2">목록</h2>
          <nav className="adm-filter">
            <a href="/admin/qr">전체</a>
            {Object.entries(LABEL).map(([k, v]) => (
              <a key={k} href={`/admin/qr?status=${k}`}>
                {v}
              </a>
            ))}
            <a href="/admin/qr?status=lost">분실 모드</a>
          </nav>
        </div>
        {issuedIds.length > 0 && (
          <form action={markPrinted} className="adm-form">
            <input type="hidden" name="ids" value={issuedIds.join(',')} />
            <button className="btn-s" type="submit">
              &lsquo;발급&rsquo; {issuedIds.length}개를 &lsquo;인쇄 넘김&rsquo;으로
            </button>
          </form>
        )}
        <table className="adm-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>라인</th>
              <th>상태</th>
              <th>등록일</th>
              <th>틀린 횟수</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(qrs ?? []).map((r) => (
              <tr key={r.id}>
                <td className="mono">
                  <a href={`/c/${r.id}`} target="_blank" rel="noreferrer">
                    {r.id}
                  </a>
                </td>
                <td>{r.line === 'dot' ? 'knock.' : 'knock!'}</td>
                <td>
                  {LABEL[r.status]}
                  {r.lost_mode && <span className="pill warn">분실</span>}
                  {r.order_id && <span className="pill">주문</span>}
                </td>
                <td className="small">{r.code_used_at ? r.code_used_at.slice(0, 10) : '-'}</td>
                <td className="small">
                  {r.failed_attempts}
                  {r.locked_until && new Date(r.locked_until) > new Date() ? ' (잠김)' : ''}
                </td>
                <td>
                  {r.status !== 'active' && r.status !== 'retired' && (
                    <form action={setQrStatus}>
                      <input type="hidden" name="qr" value={r.id} />
                      <input type="hidden" name="status" value="retired" />
                      <button className="link-btn danger" type="submit">
                        폐기
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
