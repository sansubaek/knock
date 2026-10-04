import type { CSSProperties, ReactNode } from 'react'
import { Sticker } from '@/components/Sticker'
import { CardExchangeForm, GuestbookForm, KnockButton } from '@/components/visitor'
import { cleanTheme, getTemplate, safeHref, safeImage, str, type Block, type Decor, type Line } from '@/lib/content'

export type ViewData = {
  line: Line
  template: string
  theme: Record<string, unknown>
  guestbook_mode: 'open' | 'approval' | 'off'
  blocks: Block[]
  decor: Decor[]
  guestbook: { nickname: string; message: string; at: string }[]
  knock_count: number
  today_visits: number
  total_visits: number
}

type Props = {
  data: ViewData
  qrId?: string
  preview?: boolean
  /** 편집기에서 스티커를 끌어 옮길 때 데코 층을 대신 그린다 */
  decorLayer?: ReactNode
  banner?: ReactNode
}

function d(b: Block, k: string, max = 600) {
  return str(b.data?.[k], max)
}

function fmtDate(iso: string) {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  return `${t.getMonth() + 1}.${t.getDate()}`
}

export function DecorLayer({ decor }: { decor: Decor[] }) {
  return (
    <div className="decor" aria-hidden="true">
      {decor.map((it, i) => (
        <span
          key={i}
          className="decor-item"
          style={{ left: `${it.x}%`, top: `${it.y}%`, transform: `translate(-50%,-50%) rotate(${it.rotation}deg) scale(${it.scale})`, zIndex: 1 + it.z }}
        >
          <Sticker name={it.item} />
        </span>
      ))}
    </div>
  )
}

function BangBlock({ b }: { b: Block }) {
  switch (b.type) {
    case 'profile': {
      const avatar = safeImage(b.data?.avatar)
      return (
        <section className="blk blk-profile">
          <div className="avatar">{avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">✿</span>}</div>
          <h1 className="p-name">{d(b, 'name', 20) || '이름 없음'}</h1>
          {d(b, 'bio') && <p className="p-bio">{d(b, 'bio', 80)}</p>}
        </section>
      )
    }
    case 'mood':
      return (
        <section className="blk blk-mood">
          <span className="mood-emoji" aria-hidden="true">
            {d(b, 'emoji', 8) || '☁️'}
          </span>
          <div>
            <p className="blk-label">오늘의 기분</p>
            <p>{d(b, 'text', 40)}</p>
          </div>
        </section>
      )
    case 'text':
      return d(b, 'text') ? (
        <section className="blk blk-text">
          <p>{d(b, 'text', 400)}</p>
        </section>
      ) : null
    case 'link': {
      const href = safeHref(b.data?.url)
      if (!href) return null
      return (
        <a className="blk blk-link" href={href} target="_blank" rel="noopener noreferrer nofollow">
          <span>{d(b, 'label', 30) || href.replace(/^https?:\/\//, '')}</span>
          <span aria-hidden="true">↗</span>
        </a>
      )
    }
    case 'photo': {
      const src = safeImage(b.data?.url)
      if (!src) return null
      return (
        <figure className="blk blk-photo">
          <img src={src} alt={d(b, 'caption', 60) || ''} loading="lazy" />
          {d(b, 'caption') && <figcaption>{d(b, 'caption', 60)}</figcaption>}
        </figure>
      )
    }
    case 'music': {
      const href = safeHref(b.data?.url)
      const inner = (
        <>
          <span className="music-disc" aria-hidden="true">♪</span>
          <span>
            <span className="blk-label">요즘 듣는 노래</span>
            <b>{d(b, 'title', 40) || '제목'}</b> {d(b, 'artist') && <span className="mute">· {d(b, 'artist', 40)}</span>}
          </span>
        </>
      )
      return href ? (
        <a className="blk blk-music" href={href} target="_blank" rel="noopener noreferrer nofollow">
          {inner}
        </a>
      ) : (
        <section className="blk blk-music">{inner}</section>
      )
    }
    default:
      return null
  }
}

function DotBlock({ b, qrId, preview }: { b: Block; qrId?: string; preview?: boolean }) {
  switch (b.type) {
    case 'card': {
      const avatar = safeImage(b.data?.avatar)
      const phone = d(b, 'phone', 20)
      const email = d(b, 'email', 80)
      const web = safeHref(b.data?.website)
      return (
        <section className="d-card">
          <p className="d-mark">knock.</p>
          {avatar && <img className="d-avatar" src={avatar} alt="" />}
          <h1 className="d-name">{d(b, 'name', 20) || '이름'}</h1>
          <p className="d-role">{[d(b, 'title', 30), d(b, 'org', 40)].filter(Boolean).join(' · ')}</p>
          <dl className="d-contacts">
            {phone && (
              <div>
                <dt>TEL</dt>
                <dd>
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
                </dd>
              </div>
            )}
            {email && (
              <div>
                <dt>MAIL</dt>
                <dd>
                  <a href={`mailto:${email}`}>{email}</a>
                </dd>
              </div>
            )}
            {web && (
              <div>
                <dt>WEB</dt>
                <dd>
                  <a href={web} target="_blank" rel="noopener noreferrer nofollow">
                    {web.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <div className="d-acts">
            {preview || !qrId ? (
              <span className="d-act">연락처 저장</span>
            ) : (
              <a className="d-act" href={`/c/${qrId}/vcard`}>
                연락처 저장
              </a>
            )}
            <CardExchangeForm qrId={qrId} preview={preview} />
          </div>
        </section>
      )
    }
    case 'text':
      return d(b, 'text') ? (
        <section className="d-sec">
          <p className="d-text">{d(b, 'text', 400)}</p>
        </section>
      ) : null
    case 'link': {
      const href = safeHref(b.data?.url)
      if (!href) return null
      return (
        <a className="d-link" href={href} target="_blank" rel="noopener noreferrer nofollow">
          <span>{d(b, 'label', 30) || href.replace(/^https?:\/\//, '')}</span>
          <span aria-hidden="true">→</span>
        </a>
      )
    }
    case 'career': {
      const lines = d(b, 'lines', 600)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      if (!lines.length) return null
      return (
        <section className="d-sec">
          <p className="d-k">CAREER</p>
          <ul className="d-career">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )
    }
    case 'photo': {
      const src = safeImage(b.data?.url)
      if (!src) return null
      return (
        <figure className="d-photo">
          <img src={src} alt={d(b, 'caption', 60) || ''} loading="lazy" />
          {d(b, 'caption') && <figcaption>{d(b, 'caption', 60)}</figcaption>}
        </figure>
      )
    }
    default:
      return null
  }
}

export function PageView({ data, qrId, preview, decorLayer, banner }: Props) {
  const tpl = getTemplate(data.line, data.template)
  const theme = cleanTheme(data.theme)
  const style = { ...tpl.vars, ...(theme.accent ? { '--accent': theme.accent } : {}), fontFamily: tpl.font } as CSSProperties

  if (data.line === 'dot') {
    return (
      <div className={`kp kp-dot ${tpl.className}`} style={style}>
        {tpl.fontHref && <link rel="stylesheet" href={tpl.fontHref} />}
        {banner}
        <main className="kp-col">
          {data.blocks.map((b) => (
            <DotBlock key={b.id} b={b} qrId={qrId} preview={preview} />
          ))}
          <footer className="kp-foot">
            <a href="/">knock. 으로 만든 명함</a>
          </footer>
        </main>
      </div>
    )
  }

  return (
    <div className={`kp kp-bang ${tpl.className}`} style={style}>
      {tpl.fontHref && <link rel="stylesheet" href={tpl.fontHref} />}
      {banner}
      <div className="kp-stage">
        {decorLayer ?? <DecorLayer decor={data.decor} />}
        <main className="kp-col">
          <header className="kp-top">
            <span className="kp-brand">knock!</span>
            <span className="kp-counter">
              TODAY <b>{data.today_visits}</b> <i>|</i> TOTAL <b>{data.total_visits}</b>
            </span>
          </header>
          {data.blocks.map((b) => (
            <BangBlock key={b.id} b={b} />
          ))}
          <KnockButton qrId={qrId} count={data.knock_count} preview={preview} />
          {data.guestbook_mode !== 'off' && (
            <section className="blk blk-gb">
              <h2 className="gb-h">방명록</h2>
              <GuestbookForm qrId={qrId} preview={preview} approval={data.guestbook_mode === 'approval'} />
              {data.guestbook.length > 0 ? (
                <ul className="gb-list">
                  {data.guestbook.map((g, i) => (
                    <li key={i}>
                      <b>{g.nickname}</b>
                      <span className="gb-date">{fmtDate(g.at)}</span>
                      <p>{g.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gb-empty">첫 번째 방명록을 남겨줘!</p>
              )}
            </section>
          )}
          <footer className="kp-foot">
            <a href="/">knock! 내 케이스도 만들기</a>
          </footer>
        </main>
      </div>
    </div>
  )
}
