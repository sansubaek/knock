'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { AGE_BANDS, MAX_PICKS, THEMES, pad2, themeSrc, themeThumb, type Line } from '@/lib/vote'
import type { MyVotes, VoteState } from '@/lib/vote-server'
import { voteAction } from './actions'

const LINES: { key: Line; name: string; tag: string; about: string }[] = [
  { key: 'bang', name: 'knock!', tag: '내 방', about: '친구에게 보여주는 내 방이에요. 꾸미기, 노크, 방명록이 있어요.' },
  { key: 'dot', name: 'knock.', tag: '명함', about: '일할 때 건네는 명함이에요. 찍으면 연락처가 바로 저장돼요.' },
]

function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i + 1)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function VoteClient({ initial, startLine }: { initial: MyVotes; startLine: Line }) {
  const [line, setLine] = useState<Line>(startLine)
  const [picks, setPicks] = useState<Record<Line, number[]>>({ bang: initial.bang, dot: initial.dot })
  const [age, setAge] = useState<string>(initial.age ?? '')
  const [order, setOrder] = useState<Record<Line, number[]>>({
    bang: THEMES.bang.map((t) => t.no),
    dot: THEMES.dot.map((t) => t.no),
  })
  const [byNumber, setByNumber] = useState(false)
  const [view, setView] = useState<number | null>(null)
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState('')
  const [state, formAction, pending] = useActionState<VoteState, FormData>(voteAction, { ok: false, message: '' })
  const voted = initial.bang.length + initial.dot.length > 0
  const random = useRef<Record<Line, number[]> | null>(null)
  const viewBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    viewBox.current?.scrollTo(0, 0)
  }, [view])

  // 앞 번호에 표가 몰리지 않게 사람마다 순서를 섞어서 보여준다
  useEffect(() => {
    random.current = { bang: shuffled(THEMES.bang.length), dot: shuffled(THEMES.dot.length) }
    setOrder(random.current)
  }, [])
  useEffect(() => {
    if (byNumber) setOrder({ bang: THEMES.bang.map((t) => t.no), dot: THEMES.dot.map((t) => t.no) })
    else if (random.current) setOrder(random.current)
  }, [byNumber])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    document.body.style.overflow = view !== null || sheet ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [view, sheet])

  const themes = THEMES[line]
  const mine = picks[line]
  const meta = LINES.find((l) => l.key === line)!

  function toggle(no: number) {
    const cur = picks[line]
    if (cur.includes(no)) {
      setPicks({ ...picks, [line]: cur.filter((n) => n !== no) })
      return
    }
    if (cur.length >= MAX_PICKS) {
      setToast('5개까지 고를 수 있어요. 아래에서 하나를 빼고 골라주세요.')
      return
    }
    const next = [...cur, no]
    if (next.length === MAX_PICKS) setToast(`${meta.name} 5개 다 골랐어요!`)
    setPicks({ ...picks, [line]: next })
  }

  const viewIdx = view === null ? -1 : order[line].indexOf(view)
  function step(d: number) {
    const o = order[line]
    setView(o[(viewIdx + d + o.length) % o.length])
  }

  const total = picks.bang.length + picks.dot.length
  const done = state.ok && !pending

  return (
    <div className="vt">
      <header className="vt-top">
        <a className="vt-logo" href="/">
          knock
        </a>
        <span className="vt-beta">BETA</span>
        <a className="vt-home" href="/">
          홈으로
        </a>
      </header>

      <section className="vt-intro">
        <p className="vt-eyebrow">테마 투표</p>
        <h1>어떤 페이지로 만들고 싶어요?</h1>
        <p className="vt-lead">
          케이스 QR을 찍으면 열리는 페이지 디자인을 고르고 있어요. 마음에 드는 걸 <b>1위부터 5위까지</b> 골라주세요. 로그인 없이 1분이면 돼요.
        </p>
        <ol className="vt-how">
          <li>
            <i>1</i>그림을 누르면 크게 보여요
          </li>
          <li>
            <i>2</i>&lsquo;고르기&rsquo;를 누른 순서가 순위예요
          </li>
          <li>
            <i>3</i>아래 버튼으로 제출하면 끝
          </li>
        </ol>
        {voted && !done && <p className="vt-again">이미 투표했어요. 순위를 바꾸고 다시 제출하면 새 순위로 바뀌어요.</p>}
      </section>

      <div className="vt-tabs" role="tablist" aria-label="라인 고르기">
        {LINES.map((l) => (
          <button
            key={l.key}
            type="button"
            role="tab"
            aria-selected={line === l.key}
            className={`vt-tab ${l.key}${line === l.key ? ' on' : ''}`}
            onClick={() => {
              setLine(l.key)
              setView(null)
            }}
          >
            <b>{l.name}</b>
            <span>
              {l.tag} · {THEMES[l.key].length}개
            </span>
            <em className={picks[l.key].length === MAX_PICKS ? 'full' : ''}>
              {picks[l.key].length}/{MAX_PICKS}
            </em>
          </button>
        ))}
      </div>

      <div className="vt-sub">
        <p>{meta.about}</p>
        <button type="button" className="vt-sort" onClick={() => setByNumber((v) => !v)}>
          {byNumber ? '섞어서 보기' : '번호순으로 보기'}
        </button>
      </div>

      <div className="vt-grid">
        {order[line].map((no) => {
          const t = themes[no - 1]
          const rank = mine.indexOf(no) + 1
          return (
            <article key={`${line}-${no}`} className={`vt-card${rank ? ' picked' : ''}`}>
              <button type="button" className="vt-shot" onClick={() => setView(no)} aria-label={`${pad2(no)} ${t.name} 크게 보기`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={themeThumb(line, no)} alt="" loading="lazy" width={390} height={640} />
                {rank > 0 && <span className="vt-rank">{rank}위</span>}
                <span className="vt-zoom" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <circle cx="11" cy="11" r="6" />
                    <path d="M20 20l-4.5-4.5" />
                  </svg>
                </span>
              </button>
              <div className="vt-meta">
                <span className="vt-no">{pad2(no)}</span>
                <b>{t.name}</b>
              </div>
              <p className="vt-desc">{t.desc}</p>
              <button type="button" className={`vt-pick${rank ? ' on' : ''}`} onClick={() => toggle(no)} aria-pressed={rank > 0}>
                {rank ? `${rank}위 · 빼기` : '고르기'}
              </button>
            </article>
          )
        })}
      </div>

      <p className="vt-foot">
        이름이나 연락처는 받지 않아요. 같은 브라우저에서 다시 내면 덮어써져요. <a href="/privacy">개인정보처리방침</a>
      </p>

      {/* 아래 고정: 지금 고른 순위 + 제출 */}
      <div className="vt-tray">
        <div className="vt-slots" aria-label={`${meta.name} 고른 순위`}>
          {Array.from({ length: MAX_PICKS }, (_, i) => {
            const no = mine[i]
            return no ? (
              <button key={i} type="button" className="vt-slot on" onClick={() => toggle(no)} aria-label={`${i + 1}위 ${themes[no - 1].name} 빼기`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={themeThumb(line, no)} alt="" />
                <i>{i + 1}</i>
              </button>
            ) : (
              <span key={i} className="vt-slot">
                <i>{i + 1}</i>
              </span>
            )
          })}
        </div>
        <button type="button" className="vt-submit" disabled={total === 0} onClick={() => setSheet(true)}>
          제출하기
        </button>
      </div>

      {toast && (
        <div className="vt-toast" role="status">
          {toast}
        </div>
      )}

      {/* 크게 보기: 바깥 상자 하나만 스크롤 (맨 위부터) */}
      {view !== null && (
        <div className="vt-view" role="dialog" aria-modal="true" aria-label={`${pad2(view)} ${themes[view - 1].name}`} ref={viewBox}>
          <div className="vt-vbar">
            <button type="button" onClick={() => setView(null)} aria-label="닫기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <b>
              {pad2(view)} · {themes[view - 1].name}
            </b>
            <button type="button" onClick={() => step(-1)} aria-label="이전 테마">
              ←
            </button>
            <button type="button" onClick={() => step(1)} aria-label="다음 테마">
              →
            </button>
          </div>
          <Sheet key={`${line}-${view}`} src={themeSrc(line, view)} h={themes[view - 1].h} />
          <div className="vt-vpick">
            <button type="button" className={`vt-pick big${mine.includes(view) ? ' on' : ''}`} onClick={() => toggle(view)}>
              {mine.includes(view) ? `${mine.indexOf(view) + 1}위 · 빼기` : '이 테마 고르기'}
            </button>
          </div>
        </div>
      )}

      {/* 제출 확인 */}
      {sheet && (
        <div className="vt-sheet-bg" onClick={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="vt-sheet" role="dialog" aria-modal="true" aria-labelledby="vtSheetT">
            {done ? (
              <div className="vt-done">
                <span className="vt-check" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <h2 id="vtSheetT">투표했어요! 고마워요</h2>
                <p>{state.saved && (!state.saved.bang || !state.saved.dot) ? `${state.saved.bang ? 'knock.' : 'knock!'}도 골라주면 큰 도움이 돼요.` : '고른 테마는 정식 출시 때 내 페이지로 쓸 수 있게 만들게요.'}</p>
                <div className="vt-done-acts">
                  {state.saved && (!state.saved.bang || !state.saved.dot) && (
                    <button
                      type="button"
                      className="vt-btn dark"
                      onClick={() => {
                        setLine(state.saved!.bang ? 'dot' : 'bang')
                        setSheet(false)
                        window.scrollTo(0, 0)
                      }}
                    >
                      {state.saved.bang ? 'knock.' : 'knock!'} 고르러 가기
                    </button>
                  )}
                  <a className="vt-btn" href="/#beta">
                    베타 테스터 신청하기
                  </a>
                  <a className="vt-btn ghost" href="/">
                    홈으로
                  </a>
                </div>
              </div>
            ) : (
              <form action={formAction}>
                <h2 id="vtSheetT">이 순위로 낼까요?</h2>
                {LINES.map((l) => (
                  <div key={l.key} className="vt-sum">
                    <div className="vt-sum-h">
                      <b>{l.name}</b>
                      <span>{picks[l.key].length ? `${picks[l.key].length}개 골랐어요` : '아직 안 골랐어요 (건너뛰어도 돼요)'}</span>
                    </div>
                    {picks[l.key].length > 0 && (
                      <ol>
                        {picks[l.key].map((no, i) => (
                          <li key={no}>
                            <i>{i + 1}위</i>
                            {pad2(no)} {THEMES[l.key][no - 1].name}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
                <fieldset className="vt-age">
                  <legend>나이대 (선택)</legend>
                  <div>
                    {AGE_BANDS.map((b) => (
                      <label key={b.key}>
                        <input type="radio" name="age" value={b.key} checked={age === b.key} onChange={() => setAge(b.key)} onClick={() => age === b.key && setAge('')} />
                        <span>{b.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <input type="hidden" name="bang" value={picks.bang.join(',')} />
                <input type="hidden" name="dot" value={picks.dot.join(',')} />
                <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="vt-hp" />
                {state.message && !state.ok && (
                  <p className="vt-err" role="alert">
                    {state.message}
                  </p>
                )}
                <div className="vt-sheet-acts">
                  <button type="button" className="vt-btn ghost" onClick={() => setSheet(false)}>
                    더 고를래요
                  </button>
                  <button type="submit" className="vt-btn dark" disabled={pending || total === 0}>
                    {pending ? '보내는 중…' : '제출하기'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** 테마 원본을 폭에 맞춰 줄이고, 높이를 다 펼쳐서 바깥에서 스크롤한다 */
function Sheet({ src, h }: { src: string; h: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useEffect(() => {
    const fit = () => setK(Math.min(1, (box.current?.clientWidth ?? 390) / 390))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  const style = useMemo(() => ({ height: Math.round(h * k) }), [h, k])
  return (
    <div className="vt-frame" ref={box} style={style}>
      <iframe src={src} title="테마 크게 보기" tabIndex={-1} scrolling="no" style={{ height: h, transform: `scale(${k})` }} />
    </div>
  )
}
