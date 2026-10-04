'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageView, type ViewData } from '@/components/PageView'
import { Sticker } from '@/components/Sticker'
import {
  ACCENTS,
  BLOCK_DEFS,
  cleanBlockData,
  cleanTheme,
  isBlockType,
  STICKER_NAMES,
  STICKERS,
  templatesFor,
  VISIBILITY_LABELS,
  type Block,
  type BlockType,
  type Decor,
  type Line,
} from '@/lib/content'
import { getBrowserClient } from '@/lib/supabase/browser'

type PageInfo = {
  id: string
  line: Line
  template: string
  theme: Record<string, unknown>
  visibility: string
  guestbook_mode: 'open' | 'approval' | 'off'
  hasPin: boolean
}
type Entry = { id: string; nickname: string; message: string; status: string; created_at: string }
type Card = { id: string; name: string; org: string | null; contact: string; memo: string | null; created_at: string }

type Props = {
  userId: string
  welcome: boolean
  page: PageInfo
  initialBlocks: Block[]
  initialDecor: Decor[]
  guestbook: Entry[]
  cards: Card[]
  qrIds: string[]
  knockCount: number
}

type Tab = 'content' | 'design' | 'privacy' | 'guestbook' | 'cards'

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

export function Editor(props: Props) {
  const supabase = getBrowserClient()
  const { page } = props
  const line = page.line
  const [tab, setTab] = useState<Tab>('content')
  const [blocks, setBlocks] = useState<Block[]>(props.initialBlocks)
  const [removed, setRemoved] = useState<string[]>([])
  const [template, setTemplate] = useState(page.template)
  const [accent, setAccent] = useState<string | undefined>(cleanTheme(page.theme).accent)
  const [decor, setDecor] = useState<Decor[]>(props.initialDecor)
  const [selected, setSelected] = useState<number | null>(null)
  const [visibility, setVisibility] = useState(page.visibility)
  const [gbMode, setGbMode] = useState(page.guestbook_mode)
  const [hasPin, setHasPin] = useState(page.hasPin)
  const [entries, setEntries] = useState<Entry[]>(props.guestbook)
  const [cards, setCards] = useState<Card[]>(props.cards)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(
    props.welcome ? { ok: true, text: '문이 열렸어요! 이제 내 공간을 꾸며볼까요?' } : null,
  )
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  // 저장 안 하고 나가려 할 때 한 번 묻기
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  function flash(ok: boolean, text: string) {
    setToast({ ok, text })
  }
  function touch() {
    setDirty(true)
  }

  // ── 블록 ──
  function updateBlock(i: number, key: string, value: string) {
    setBlocks((bs) => bs.map((b, k) => (k === i ? { ...b, data: { ...b.data, [key]: value } } : b)))
    touch()
  }
  function move(i: number, dir: -1 | 1) {
    setBlocks((bs) => {
      const j = i + dir
      if (j < 0 || j >= bs.length) return bs
      const next = [...bs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    touch()
  }
  function toggleVisible(i: number) {
    setBlocks((bs) => bs.map((b, k) => (k === i ? { ...b, is_visible: b.is_visible === false } : b)))
    touch()
  }
  function removeBlock(i: number) {
    const b = blocks[i]
    if (!window.confirm(`'${isBlockType(b.type) ? BLOCK_DEFS[b.type].label : b.type}' 블록을 지울까요?`)) return
    setRemoved((r) => [...r, b.id])
    setBlocks((bs) => bs.filter((_, k) => k !== i))
    touch()
  }
  function addBlock(type: BlockType) {
    if (blocks.length >= 40) return flash(false, '블록은 40개까지 만들 수 있어요.')
    setBlocks((bs) => [...bs, { id: uid(), type, data: {}, is_visible: true }])
    touch()
  }

  // ── 저장 ──
  async function save() {
    setSaving(true)
    try {
      // 한 번에 저장 (중간에 실패하면 전부 취소돼서 내용이 날아가지 않는다)
      const { error } = await supabase.rpc('save_page', {
        p_page_id: page.id,
        p_blocks: blocks.map((b) => ({ id: b.id, type: b.type, is_visible: b.is_visible !== false, data: cleanBlockData(b.type, b.data) })),
        p_removed: removed,
        p_page: { template, theme: accent ? { accent } : {}, guestbook_mode: gbMode, visibility: visibility !== 'locked' || hasPin ? visibility : null },
        p_decor: decor.map((d) => ({ item: d.item, x: d.x, y: d.y, rotation: d.rotation, scale: d.scale })),
      })
      if (error) throw error
      setRemoved([])
      setDirty(false)
      flash(true, '저장했어요.')
    } catch (e) {
      console.error(e)
      flash(false, '저장하지 못했어요. 잠시 뒤에 다시 눌러주세요.')
    } finally {
      setSaving(false)
    }
  }

  // ── 사진 올리기 ──
  async function upload(file: File): Promise<string | null> {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      flash(false, 'jpg, png, webp 사진만 올릴 수 있어요.')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      flash(false, '사진은 5MB까지 올릴 수 있어요.')
      return null
    }
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${props.userId}/${uid()}.${ext}`
    const { error } = await supabase.storage.from('page-media').upload(path, file, { contentType: file.type, upsert: false })
    if (error) {
      flash(false, '사진을 올리지 못했어요.')
      return null
    }
    return supabase.storage.from('page-media').getPublicUrl(path).data.publicUrl
  }

  // ── 암호 ──
  async function savePin(pin: string) {
    if (!/^\d{4,6}$/.test(pin)) return flash(false, '숫자 4~6자리로 정해주세요.')
    const { error } = await supabase.rpc('set_page_pin', { p_page_id: page.id, p_pin: pin })
    if (error) return flash(false, '암호를 저장하지 못했어요.')
    setHasPin(true)
    setVisibility('locked')
    flash(true, '암호를 걸었어요. 이제 암호를 아는 사람만 들어올 수 있어요.')
  }

  // ── 방명록·명함 관리 ──
  async function setEntryStatus(id: string, status: 'visible' | 'hidden') {
    const { error } = await supabase.from('guestbook_entries').update({ status }).eq('id', id)
    if (error) return flash(false, '바꾸지 못했어요.')
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, status } : e)))
  }
  async function deleteEntry(id: string) {
    if (!window.confirm('이 방명록을 지울까요?')) return
    const { error } = await supabase.from('guestbook_entries').delete().eq('id', id)
    if (error) return flash(false, '지우지 못했어요.')
    setEntries((es) => es.filter((e) => e.id !== id))
  }
  async function deleteCard(id: string) {
    if (!window.confirm('받은 명함을 지울까요?')) return
    const { error } = await supabase.from('received_cards').delete().eq('id', id)
    if (error) return flash(false, '지우지 못했어요.')
    setCards((cs) => cs.filter((c) => c.id !== id))
  }
  function downloadCardsCsv() {
    const head = '이름,소속,연락처,메모,받은 날짜'
    // 엑셀 수식 주입 방지: =, +, -, @ 로 시작하면 앞에 ' 붙이기
    const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
    const rows = cards.map((c) => [c.name, c.org ?? '', c.contact, c.memo ?? '', c.created_at.slice(0, 10)].map(cell).join(','))
    const blob = new Blob(['﻿' + [head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'knock-받은명함.csv'
    a.click()
  }

  // ── 미리보기 데이터 ──
  const preview: ViewData = useMemo(
    () => ({
      line,
      template,
      theme: accent ? { accent } : {},
      guestbook_mode: gbMode,
      blocks: blocks.filter((b) => b.is_visible !== false),
      decor,
      guestbook: entries.filter((e) => e.status === 'visible').slice(0, 20).map((e) => ({ nickname: e.nickname, message: e.message, at: e.created_at })),
      knock_count: props.knockCount,
      today_visits: 0,
      total_visits: 0,
    }),
    [line, template, accent, gbMode, blocks, decor, entries, props.knockCount],
  )

  const pendingCount = entries.filter((e) => e.status === 'pending').length
  const tabs: [Tab, string][] = [
    ['content', '내용'],
    ['design', '꾸미기'],
    ['privacy', '공개 범위'],
    ...(line === 'bang' ? ([['guestbook', `방명록${pendingCount ? ` (${pendingCount})` : ''}`]] as [Tab, string][]) : []),
    ...(line === 'dot' ? ([['cards', `받은 명함 (${cards.length})`]] as [Tab, string][]) : []),
  ]

  return (
    <div className={`ed ed-${line}`}>
      <header className="ed-top">
        <Link href="/my" className="ed-back">
          ← 내 knock
        </Link>
        <span className="ed-title">{line === 'dot' ? 'knock.' : 'knock!'} 꾸미기</span>
        <div className="ed-top-acts">
          {props.qrIds[0] && (
            <a className="btn-s" href={`/c/${props.qrIds[0]}`} target="_blank" rel="noreferrer">
              실제 화면
            </a>
          )}
          <button type="button" className="btn-s solid" onClick={save} disabled={saving || !dirty}>
            {saving ? '저장 중…' : dirty ? '저장' : '저장됨'}
          </button>
        </div>
      </header>

      <div className="ed-body">
        <div className={`ed-panel ${showPreview ? 'hide-sm' : ''}`}>
          <nav className="ed-tabs" role="tablist">
            {tabs.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className="ed-tab" onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </nav>

          {tab === 'content' && (
            <div className="ed-sec">
              {blocks.map((b, i) => {
                const def = isBlockType(b.type) ? BLOCK_DEFS[b.type] : null
                if (!def) return null
                return (
                  <div key={b.id} className={`ed-block ${b.is_visible === false ? 'off' : ''}`}>
                    <div className="ed-block-head">
                      <b>{def.label}</b>
                      <div className="ed-block-acts">
                        <button type="button" onClick={() => move(i, -1)} aria-label="위로" disabled={i === 0}>
                          ↑
                        </button>
                        <button type="button" onClick={() => move(i, 1)} aria-label="아래로" disabled={i === blocks.length - 1}>
                          ↓
                        </button>
                        <button type="button" onClick={() => toggleVisible(i)}>
                          {b.is_visible === false ? '보이기' : '숨기기'}
                        </button>
                        <button type="button" onClick={() => removeBlock(i)} className="danger">
                          삭제
                        </button>
                      </div>
                    </div>
                    {def.hint && <p className="ed-hint">{def.hint}</p>}
                    {def.fields.map((f) => {
                      const val = typeof b.data[f.key] === 'string' ? (b.data[f.key] as string) : ''
                      const fid = `${b.id}-${f.key}`
                      if (f.kind === 'image') {
                        return (
                          <ImageField
                            key={f.key}
                            id={fid}
                            label={f.label}
                            value={val}
                            onUpload={upload}
                            onChange={(v) => updateBlock(i, f.key, v)}
                          />
                        )
                      }
                      return (
                        <label key={f.key} className="ed-field" htmlFor={fid}>
                          <span>
                            {f.label}
                            {f.kind !== 'emoji' && <em>{val.length}/{f.max}</em>}
                          </span>
                          {f.kind === 'textarea' ? (
                            <textarea id={fid} maxLength={f.max} rows={3} value={val} placeholder={f.placeholder} onChange={(e) => updateBlock(i, f.key, e.target.value)} />
                          ) : (
                            <input
                              id={fid}
                              type={f.kind === 'email' ? 'email' : f.kind === 'tel' ? 'tel' : f.kind === 'url' ? 'url' : 'text'}
                              maxLength={f.max}
                              value={val}
                              placeholder={f.placeholder}
                              onChange={(e) => updateBlock(i, f.key, e.target.value)}
                            />
                          )}
                        </label>
                      )
                    })}
                  </div>
                )
              })}
              <div className="ed-add">
                <p>블록 추가</p>
                <div className="ed-add-btns">
                  {(Object.keys(BLOCK_DEFS) as BlockType[])
                    .filter((t) => BLOCK_DEFS[t].lines.includes(line))
                    .map((t) => (
                      <button key={t} type="button" className="btn-s" onClick={() => addBlock(t)}>
                        + {BLOCK_DEFS[t].label}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'design' && (
            <div className="ed-sec">
              <h3 className="ed-h">템플릿</h3>
              <div className="tpl-grid">
                {templatesFor(line).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`tpl ${template === t.key ? 'on' : ''}`}
                    onClick={() => {
                      setTemplate(t.key)
                      touch()
                    }}
                  >
                    <span className="tpl-sw" style={{ background: t.vars['--bg'], borderColor: t.vars['--edge'] }}>
                      <i style={{ background: t.vars['--card'] }} />
                      <i style={{ background: t.vars['--accent'] }} />
                    </span>
                    <b>{t.name}</b>
                    <span>{t.desc}</span>
                  </button>
                ))}
              </div>

              <h3 className="ed-h">포인트 색</h3>
              <div className="sw-row">
                <button
                  type="button"
                  className={`sw sw-none ${!accent ? 'on' : ''}`}
                  onClick={() => {
                    setAccent(undefined)
                    touch()
                  }}
                  aria-label="템플릿 기본색"
                >
                  기본
                </button>
                {ACCENTS[line].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`sw ${accent === c ? 'on' : ''}`}
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => {
                      setAccent(c)
                      touch()
                    }}
                  />
                ))}
              </div>

              {line === 'bang' && (
                <>
                  <h3 className="ed-h">스티커</h3>
                  <p className="ed-hint">누르면 미리보기에 붙어요. 미리보기에서 끌어서 옮기고, 눌러서 크기·회전을 바꿔요. ({decor.length}/30)</p>
                  <div className="stk-grid">
                    {STICKERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="stk"
                        onClick={() => {
                          if (decor.length >= 30) return flash(false, '스티커는 30개까지 붙일 수 있어요.')
                          setDecor((ds) => [...ds, { item: s, x: 20 + Math.random() * 60, y: 8 + Math.random() * 30, rotation: Math.round(Math.random() * 30 - 15), scale: 1, z: ds.length }])
                          setSelected(decor.length)
                          setShowPreview(true)
                          touch()
                        }}
                      >
                        <Sticker name={s} size={40} />
                        <span>{STICKER_NAMES[s]}</span>
                      </button>
                    ))}
                  </div>
                  {selected !== null && decor[selected] && (
                    <StickerControls
                      d={decor[selected]}
                      onChange={(nd) => {
                        setDecor((ds) => ds.map((x, k) => (k === selected ? nd : x)))
                        touch()
                      }}
                      onDelete={() => {
                        setDecor((ds) => ds.filter((_, k) => k !== selected))
                        setSelected(null)
                        touch()
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'privacy' && (
            <div className="ed-sec">
              <h3 className="ed-h">공개 범위</h3>
              <div className="radio-list">
                {Object.entries(VISIBILITY_LABELS).map(([k, v]) => (
                  <label key={k} className={`radio ${visibility === k ? 'on' : ''}`}>
                    <input
                      type="radio"
                      name="vis"
                      checked={visibility === k}
                      onChange={() => {
                        setVisibility(k)
                        touch()
                      }}
                    />
                    <span>
                      <b>{v.label}</b>
                      <em>{v.desc}</em>
                    </span>
                  </label>
                ))}
              </div>
              {visibility === 'locked' && <PinBox hasPin={hasPin} onSave={savePin} />}

              {line === 'bang' && (
                <>
                  <h3 className="ed-h">방명록</h3>
                  <div className="radio-list">
                    {(
                      [
                        ['open', '바로 공개', '남기면 바로 보여요'],
                        ['approval', '승인제', '내가 확인한 것만 보여요'],
                        ['off', '끄기', '방명록을 받지 않아요'],
                      ] as const
                    ).map(([k, label, desc]) => (
                      <label key={k} className={`radio ${gbMode === k ? 'on' : ''}`}>
                        <input
                          type="radio"
                          name="gb"
                          checked={gbMode === k}
                          onChange={() => {
                            setGbMode(k)
                            touch()
                          }}
                        />
                        <span>
                          <b>{label}</b>
                          <em>{desc}</em>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <p className="ed-hint">분실 모드는 내 knock 화면의 &lsquo;내 케이스&rsquo;에서 켜고 꺼요.</p>
            </div>
          )}

          {tab === 'guestbook' && (
            <div className="ed-sec">
              {entries.length === 0 ? (
                <p className="ed-hint">아직 방명록이 없어요.</p>
              ) : (
                <ul className="gb-admin">
                  {entries.map((e) => (
                    <li key={e.id} className={`st-${e.status}`}>
                      <div>
                        <b>{e.nickname}</b> <span className="mute">{e.created_at.slice(5, 10).replace('-', '.')}</span>
                        {e.status === 'pending' && <span className="pill warn">승인 대기</span>}
                        {e.status === 'hidden' && <span className="pill">숨김</span>}
                        <p>{e.message}</p>
                      </div>
                      <div className="gb-admin-acts">
                        {e.status !== 'visible' ? (
                          <button type="button" className="btn-s" onClick={() => setEntryStatus(e.id, 'visible')}>
                            보이기
                          </button>
                        ) : (
                          <button type="button" className="btn-s" onClick={() => setEntryStatus(e.id, 'hidden')}>
                            숨기기
                          </button>
                        )}
                        <button type="button" className="btn-s warn" onClick={() => deleteEntry(e.id)}>
                          삭제
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'cards' && (
            <div className="ed-sec">
              {cards.length === 0 ? (
                <p className="ed-hint">아직 받은 명함이 없어요. 상대가 내 케이스를 찍고 &lsquo;내 명함 남기기&rsquo;를 누르면 여기에 쌓여요.</p>
              ) : (
                <>
                  <button type="button" className="btn-s" onClick={downloadCardsCsv}>
                    엑셀(CSV)로 받기
                  </button>
                  <ul className="card-list">
                    {cards.map((c) => (
                      <li key={c.id}>
                        <div>
                          <b>{c.name}</b> {c.org && <span className="mute">· {c.org}</span>}
                          <p>{c.contact}</p>
                          {c.memo && <p className="mute">{c.memo}</p>}
                          <p className="mute small">{c.created_at.slice(0, 10)}</p>
                        </div>
                        <button type="button" className="btn-s warn" onClick={() => deleteCard(c.id)}>
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className={`ed-preview ${showPreview ? '' : 'hide-sm'}`}>
          <div className="phone-frame">
            <PageView
              data={preview}
              preview
              decorLayer={
                line === 'bang' ? (
                  <EditableDecor
                    decor={decor}
                    selected={selected}
                    onSelect={(i) => {
                      setSelected(i)
                      setTab('design')
                    }}
                    onMove={(i, x, y) => {
                      setDecor((ds) => ds.map((d, k) => (k === i ? { ...d, x, y } : d)))
                      touch()
                    }}
                  />
                ) : undefined
              }
            />
          </div>
        </div>
      </div>

      <button type="button" className="ed-toggle" onClick={() => setShowPreview((v) => !v)}>
        {showPreview ? '편집으로' : '미리보기'}
      </button>
      {toast && (
        <div className={`toast ${toast.ok ? 'ok' : 'err'}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  )
}

function ImageField({ id, label, value, onUpload, onChange }: { id: string; label: string; value: string; onUpload: (f: File) => Promise<string | null>; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="ed-field">
      <span>{label}</span>
      <div className="img-field">
        {value ? <img src={value} alt="" /> : <span className="img-ph">사진 없음</span>}
        <label className="btn-s" htmlFor={id}>
          {busy ? '올리는 중…' : value ? '바꾸기' : '사진 올리기'}
        </label>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            setBusy(true)
            const url = await onUpload(f)
            setBusy(false)
            if (url) onChange(url)
            e.target.value = ''
          }}
        />
        {value && (
          <button type="button" className="link-btn" onClick={() => onChange('')}>
            빼기
          </button>
        )}
      </div>
    </div>
  )
}

function PinBox({ hasPin, onSave }: { hasPin: boolean; onSave: (pin: string) => void }) {
  const [pin, setPin] = useState('')
  return (
    <div className="pin-box">
      <p>{hasPin ? '암호가 걸려 있어요. 바꾸려면 새 암호를 넣으세요.' : '암호 잠금을 쓰려면 먼저 숫자 암호를 정해주세요.'}</p>
      <div className="inline-form">
        <input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="숫자 4~6자리" aria-label="새 암호" />
        <button type="button" className="btn-s solid" onClick={() => onSave(pin)}>
          암호 저장
        </button>
      </div>
    </div>
  )
}

function StickerControls({ d, onChange, onDelete }: { d: Decor; onChange: (d: Decor) => void; onDelete: () => void }) {
  return (
    <div className="stk-ctl">
      <span>
        <Sticker name={d.item} size={28} /> 고른 스티커
      </span>
      <button type="button" className="btn-s" onClick={() => onChange({ ...d, scale: Math.max(0.5, +(d.scale - 0.15).toFixed(2)) })}>
        작게
      </button>
      <button type="button" className="btn-s" onClick={() => onChange({ ...d, scale: Math.min(2.5, +(d.scale + 0.15).toFixed(2)) })}>
        크게
      </button>
      <button type="button" className="btn-s" onClick={() => onChange({ ...d, rotation: d.rotation - 15 })}>
        ↺
      </button>
      <button type="button" className="btn-s" onClick={() => onChange({ ...d, rotation: d.rotation + 15 })}>
        ↻
      </button>
      <button type="button" className="btn-s warn" onClick={onDelete}>
        떼기
      </button>
    </div>
  )
}

function EditableDecor({ decor, selected, onSelect, onMove }: { decor: Decor[]; selected: number | null; onSelect: (i: number) => void; onMove: (i: number, x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)

  function pos(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect()
    const x = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100))
    const y = Math.min(99, Math.max(1, ((e.clientY - r.top) / r.height) * 100))
    return { x: +x.toFixed(2), y: +y.toFixed(2) }
  }

  return (
    <div ref={ref} className="decor editing">
      {decor.map((it, i) => (
        <span
          key={i}
          className={`decor-item ${selected === i ? 'sel' : ''}`}
          style={{ left: `${it.x}%`, top: `${it.y}%`, transform: `translate(-50%,-50%) rotate(${it.rotation}deg) scale(${it.scale})`, zIndex: 1 + i }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = i
            onSelect(i)
          }}
          onPointerMove={(e) => {
            if (drag.current !== i) return
            const p = pos(e)
            onMove(i, p.x, p.y)
          }}
          onPointerUp={(e) => {
            drag.current = null
            e.currentTarget.releasePointerCapture?.(e.pointerId)
          }}
        >
          <Sticker name={it.item} />
        </span>
      ))}
    </div>
  )
}
