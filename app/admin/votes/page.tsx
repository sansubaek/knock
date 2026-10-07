import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { kst } from '@/lib/admin-format'
import { AGE_BANDS, MAX_PICKS, THEMES, VOTE_OPEN, pad2, themeSrc, themeThumb, type Line } from '@/lib/vote'
import { Badge, Empty, PageHead, Tabs } from '../ui'

type Row = { picks: number[]; age_band: string | null; net: string | null; updated_at: string }

export default async function AdminVotes({ searchParams }: { searchParams: Promise<{ line?: string; age?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const line: Line = sp.line === 'dot' ? 'dot' : 'bang'
  const age = AGE_BANDS.some((b) => b.key === sp.age) ? sp.age! : 'all'
  const db = createAdminClient()

  const [{ data: all }, { count: bangN }, { count: dotN }] = await Promise.all([
    db.from('theme_votes').select('picks, age_band, net, updated_at').eq('line', line).order('updated_at', { ascending: false }).limit(20000),
    db.from('theme_votes').select('id', { count: 'exact', head: true }).eq('line', 'bang'),
    db.from('theme_votes').select('id', { count: 'exact', head: true }).eq('line', 'dot'),
  ])
  const rows = ((all ?? []) as Row[]).filter((r) => age === 'all' || r.age_band === age)
  const themes = THEMES[line]

  // 점수: 1위 5점, 2위 4점 … 5위 1점
  const score = themes.map((t) => ({ ...t, points: 0, first: 0, top5: 0, rankSum: 0 }))
  for (const r of rows) {
    r.picks.forEach((no, i) => {
      const s = score[no - 1]
      if (!s) return
      s.points += MAX_PICKS - i
      s.top5 += 1
      s.rankSum += i + 1
      if (i === 0) s.first += 1
    })
  }
  const ranked = [...score].sort((a, b) => b.points - a.points || b.first - a.first || a.no - b.no)
  const maxPts = Math.max(1, ...ranked.map((s) => s.points))

  const ageCount = new Map<string, number>()
  ;(all ?? []).forEach((r) => ageCount.set(r.age_band ?? 'none', (ageCount.get(r.age_band ?? 'none') ?? 0) + 1))

  // 같은 네트워크(같은 와이파이 등)에서 몰려온 표
  const netCount = new Map<string, number>()
  rows.forEach((r) => r.net && netCount.set(r.net, (netCount.get(r.net) ?? 0) + 1))
  const heavy = [...netCount.values()].filter((n) => n >= 8).sort((a, b) => b - a)
  const avgPicks = rows.length ? rows.reduce((s, r) => s + r.picks.length, 0) / rows.length : 0
  const q = (o: { line?: string; age?: string }) => {
    const p = new URLSearchParams({ line: o.line ?? line, ...(o.age && o.age !== 'all' ? { age: o.age } : {}) })
    return `/admin/votes?${p}`
  }

  return (
    <>
      <PageHead
        title="테마 투표"
        desc={
          <>
            베타 기능이에요. 1위 5점 · 2위 4점 · 3위 3점 · 4위 2점 · 5위 1점으로 계산해요. 투표는 로그인 없이 받고, 같은 브라우저에서 다시 내면 덮어써요.{' '}
            {VOTE_OPEN ? <Badge tone="green">투표 받는 중</Badge> : <Badge tone="gray">투표 닫힘</Badge>}
          </>
        }
      >
        <a className="ad-btn" href="/vote" target="_blank" rel="noreferrer">
          투표 화면 열기 ↗
        </a>
      </PageHead>

      <Tabs
        current={line}
        items={[
          { key: 'bang', label: 'knock! 내 방', href: q({ line: 'bang', age }), count: bangN ?? 0 },
          { key: 'dot', label: 'knock. 명함', href: q({ line: 'dot', age }), count: dotN ?? 0 },
        ]}
      />

      <nav className="ad-chips no-print" aria-label="나이대">
        {[{ key: 'all', label: '전체' }, ...AGE_BANDS].map((b) => (
          <a key={b.key} href={q({ age: b.key })} className={age === b.key ? 'on' : undefined}>
            {b.label}
            <span>{b.key === 'all' ? (all ?? []).length : ageCount.get(b.key) ?? 0}</span>
          </a>
        ))}
        <span className="ad-sub">나이대 안 고름 {ageCount.get('none') ?? 0}</span>
      </nav>

      <section className="ad-stats">
        <div className="ad-stat">
          <span className="ad-stat-l">투표한 사람</span>
          <b className="ad-stat-n">{rows.length.toLocaleString()}</b>
          <span className="ad-stat-s">브라우저 기준 (같은 사람이 폰·PC로 내면 2명)</span>
        </div>
        <div className="ad-stat">
          <span className="ad-stat-l">지금 1위</span>
          <b className="ad-stat-n">{rows.length ? `${pad2(ranked[0].no)} ${ranked[0].name}` : '-'}</b>
          <span className="ad-stat-s">{rows.length ? `${ranked[0].points}점 · 1위 표 ${ranked[0].first}개` : '아직 표가 없어요'}</span>
        </div>
        <div className="ad-stat">
          <span className="ad-stat-l">한 사람이 고른 개수</span>
          <b className="ad-stat-n">{avgPicks ? avgPicks.toFixed(1) : '-'}</b>
          <span className="ad-stat-s">평균, 최대 5개</span>
        </div>
      </section>

      {heavy.length > 0 && (
        <div className="ad-card ad-warn">
          같은 네트워크에서 8표 넘게 들어온 곳이 {heavy.length}곳 있어요 (가장 많은 곳 {heavy[0]}표). 학교·카페 와이파이일 수도 있고 한 사람이 여러 번 냈을 수도 있어요.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="ad-card">
          <Empty title="아직 표가 없어요">홈 위쪽 띠나 메뉴의 &lsquo;테마 투표&rsquo;로 들어가서 투표할 수 있어요.</Empty>
        </div>
      ) : (
        <div className="ad-card flush">
          <div className="ad-scroll">
            <table className="ad-table ad-vote">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>테마</th>
                  <th>점수</th>
                  <th>1위 표</th>
                  <th>5위 안에 든 표</th>
                  <th>평균 순위</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, i) => (
                  <tr key={s.no}>
                    <td className="ad-vrank">{s.points ? i + 1 : '-'}</td>
                    <td>
                      <a className="ad-vtheme" href={themeSrc(line, s.no)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={themeThumb(line, s.no)} alt="" loading="lazy" />
                        <span>
                          <b>
                            {pad2(s.no)} {s.name}
                          </b>
                          <small>{s.desc}</small>
                        </span>
                      </a>
                    </td>
                    <td>
                      <div className="ad-vbar">
                        <i style={{ width: `${(s.points / maxPts) * 100}%` }} />
                        <b>{s.points}</b>
                      </div>
                    </td>
                    <td>{s.first}</td>
                    <td>
                      {s.top5}
                      <small className="ad-sub"> ({Math.round((s.top5 / rows.length) * 100)}%)</small>
                    </td>
                    <td>{s.top5 ? (s.rankSum / s.top5).toFixed(1) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="ad-card">
          <div className="ad-card-h">
            <span>최근 투표</span>
            <span className="ad-sub">최근 20개 · 누가 냈는지는 알 수 없어요</span>
          </div>
          <ul className="ad-vrecent">
            {rows.slice(0, 20).map((r, i) => (
              <li key={i}>
                <span className="ad-sub">{kst(r.updated_at)}</span>
                <span>{AGE_BANDS.find((b) => b.key === r.age_band)?.label ?? '나이대 없음'}</span>
                <span>
                  {r.picks.map((no, j) => (
                    <em key={j}>
                      {j + 1}위 {themes[no - 1]?.name ?? no}
                    </em>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
