import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { QR_STATUS } from '@/lib/admin-format'
import { BatchIssue, Reissue } from '../IssueForms'
import { markPrinted } from '../actions'
import { Empty, PageHead, Tabs } from '../ui'
import { QrTable, type QrRow } from './QrTable'

export default async function AdminQr({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin()
  const { status = 'all', q: rawQ } = await searchParams
  const q = (rawQ ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  const db = createAdminClient()

  const { data: all } = await db.from('qr_codes').select('status, lost_mode').limit(5000)
  const cnt = (s: string) => (all ?? []).filter((r) => (s === 'lost' ? r.lost_mode : r.status === s)).length

  let query = db
    .from('qr_codes')
    .select('id, line, status, lost_mode, owner_id, order_id, created_at, code_used_at, failed_attempts, locked_until')
    .order('created_at', { ascending: false })
    .limit(300)
  if (status === 'lost') query = query.eq('lost_mode', true)
  else if (QR_STATUS[status]) query = query.eq('status', status)
  if (q) query = query.ilike('id', `%${q}%`)
  const { data: qrs } = await query
  const rows = qrs ?? []
  const issuedIds = rows.filter((r) => r.status === 'issued').map((r) => r.id)

  const tabHref = (s: string) => `/admin/qr${s === 'all' ? '' : `?status=${s}`}`

  return (
    <>
      <PageHead title="QR 발급 · 관리" desc="케이스에 넣을 QR과 6자리 활성화 코드를 만들고, 만든 QR의 상태를 확인해요." />

      <div className="ad-stack">
        <section className="ad-card">
          <h2 className="ad-card-h no-print">새로 발급하기</h2>
          <ol className="ad-steps no-print">
            <li>
              <b>발급</b>라인과 개수를 고르고 버튼
            </li>
            <li>
              <b>CSV 저장</b>코드는 이때 한 번만 보여요
            </li>
            <li>
              <b>업체에 SVG</b>케이스에 인쇄할 QR 파일
            </li>
            <li>
              <b>웰컴 카드 인쇄</b>포장할 때 케이스와 짝 맞춰 넣기
            </li>
          </ol>
          <BatchIssue />
        </section>

        <section className="ad-card no-print">
          <details className="ad-details">
            <summary>고객이 코드 카드를 잃어버렸을 때 (코드 재발급)</summary>
            <p className="ad-hint">아직 등록 전인 케이스만 가능해요. 새 코드를 만들면 이전 코드는 바로 못 쓰게 돼요.</p>
            <Reissue />
          </details>
        </section>

        <section className="no-print">
          <div className="ad-listbar">
            <Tabs
              current={status}
              items={[
                { key: 'all', label: '전체', href: tabHref('all'), count: (all ?? []).length },
                ...Object.entries(QR_STATUS).map(([k, v]) => ({ key: k, label: v, href: tabHref(k), count: cnt(k) })),
                { key: 'lost', label: '분실 모드', href: tabHref('lost'), count: cnt('lost') },
              ]}
            />
            <form className="ad-search" action="/admin/qr">
              {status !== 'all' && <input type="hidden" name="status" value={status} />}
              <input className="ad-input mono" name="q" defaultValue={q} placeholder="QR ID 검색" aria-label="QR ID 검색" />
            </form>
          </div>

          {issuedIds.length > 0 && (
            <form action={markPrinted} className="ad-bulk">
              <input type="hidden" name="ids" value={issuedIds.join(',')} />
              <span>
                &lsquo;발급됨&rsquo; 상태 <b>{issuedIds.length}개</b>를 업체에 넘겼다면
              </span>
              <button className="ad-btn sm" type="submit">
                인쇄 넘김으로 한 번에 바꾸기
              </button>
            </form>
          )}

          {rows.length === 0 ? (
            <div className="ad-card">
              <Empty title={q ? `'${q}'에 맞는 QR이 없어요` : '여기에 해당하는 QR이 없어요'} />
            </div>
          ) : (
            <QrTable rows={rows as QrRow[]} />
          )}
        </section>
      </div>
    </>
  )
}
