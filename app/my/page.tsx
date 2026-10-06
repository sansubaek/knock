import type { Metadata } from 'next'
import Link from 'next/link'
import { DeleteAccount } from './DeleteAccount'
import { setLostMode, updateNickname } from './actions'
import { requireMember } from '@/lib/auth'
import { getTemplate, VISIBILITY_LABELS, type Line } from '@/lib/content'

export const metadata: Metadata = { title: '내 knock' }
export const dynamic = 'force-dynamic'

const LINE_NAME: Record<Line, string> = { bang: 'knock!', dot: 'knock.' }

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

export default async function MyPage() {
  const { supabase, user, profile } = await requireMember('/my')

  const [{ data: qrs }, { data: pages }, { data: inquiries }] = await Promise.all([
    supabase.from('qr_codes').select('id, line, status, lost_mode, lost_note, page_id, code_used_at').eq('owner_id', user.id).order('created_at'),
    supabase.from('pages').select('id, line, template, visibility, guestbook_mode, updated_at').eq('owner_id', user.id).order('created_at'),
    supabase.from('inquiries').select('id, type, body, status, reply, replied_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ])

  const qrIds = (qrs ?? []).map((q) => q.id)
  const pageIds = (pages ?? []).map((p) => p.id)
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()

  const [{ data: lostMsgs }, { count: scans7 }, { count: knockCount }, { count: pendingGb }, { count: cardCount }] = await Promise.all([
    qrIds.length
      ? supabase.from('lost_messages').select('id, qr_id, message, finder_contact, location_note, created_at').in('qr_id', qrIds).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as { id: string; qr_id: string; message: string; finder_contact: string | null; location_note: string | null; created_at: string }[] }),
    qrIds.length
      ? supabase.from('scan_logs').select('id', { count: 'exact', head: true }).in('qr_id', qrIds).eq('is_owner', false).gte('scanned_at', since)
      : Promise.resolve({ count: 0 }),
    pageIds.length ? supabase.from('knocks').select('id', { count: 'exact', head: true }).in('page_id', pageIds) : Promise.resolve({ count: 0 }),
    pageIds.length
      ? supabase.from('guestbook_entries').select('id', { count: 'exact', head: true }).in('page_id', pageIds).eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    pageIds.length ? supabase.from('received_cards').select('id', { count: 'exact', head: true }).in('page_id', pageIds) : Promise.resolve({ count: 0 }),
  ])

  const anyLost = (qrs ?? []).some((q) => q.lost_mode)

  return (
    <div className="my">
      <header className="my-top">
        <Link href="/" className="my-logo">
          knock
        </Link>
        <nav>
          {profile.role === 'admin' && (
            <Link href="/admin" className="my-admin">
              관리자 페이지
            </Link>
          )}
          <Link href="/support">문의</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="link-btn">
              로그아웃
            </button>
          </form>
        </nav>
      </header>

      <main className="my-main">
        <section className="my-hello">
          <h1>
            {(scans7 ?? 0) > 0 ? (
              <>
                이번 주에 {scans7}명이
                <br />
                {profile.nickname ?? ''}님 페이지에 다녀갔어요
              </>
            ) : (
              <>
                {profile.nickname ?? ''}님, 반가워요
                <br />
                오늘은 누가 찍을까요
              </>
            )}
          </h1>
          <div className="my-stats">
            <div>
              <b>{scans7 ?? 0}</b>
              <span>최근 7일 방문</span>
            </div>
            <div>
              <b>{knockCount ?? 0}</b>
              <span>받은 노크</span>
            </div>
            <div>
              <b>{pendingGb ?? 0}</b>
              <span>승인 대기 방명록</span>
            </div>
            <div>
              <b>{cardCount ?? 0}</b>
              <span>받은 명함</span>
            </div>
          </div>
        </section>

        {anyLost && (
          <section className="my-alert" role="alert">
            <b>분실 모드가 켜져 있어요.</b> 찍은 사람에게 프로필 대신 주인 찾기 화면이 보여요. 찾으면 아래에서 꺼주세요.
          </section>
        )}

        {(lostMsgs ?? []).length > 0 && (
          <section className="my-sec">
            <h2>습득자가 남긴 메시지</h2>
            <ul className="my-list">
              {(lostMsgs ?? []).map((m) => (
                <li key={m.id} className="lost-msg">
                  <p>{m.message}</p>
                  <p className="mute">
                    {m.location_note && <>발견 장소: {m.location_note} · </>}
                    {m.finder_contact ? <>연락처: {m.finder_contact} · </> : null}
                    {ago(m.created_at)} · {m.qr_id}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="my-sec">
          <h2>내 페이지</h2>
          {(pages ?? []).length === 0 ? (
            <div className="my-empty">
              <p>아직 페이지가 없어요. 케이스 뒤 QR을 폰 카메라로 찍고 카드의 6자리 코드를 넣으면 페이지가 생겨요.</p>
              <Link href="/beta" className="btn-s">
                케이스가 없다면 베타 신청
              </Link>
            </div>
          ) : (
            <div className="my-pages">
              {(pages ?? []).map((p) => {
                const myQr = (qrs ?? []).find((q) => q.page_id === p.id && q.status === 'active')
                return (
                  <article key={p.id} className={`my-page my-page-${p.line}`}>
                    <p className="my-line">{LINE_NAME[p.line as Line]}</p>
                    <h3>{getTemplate(p.line as Line, p.template).name} 테마</h3>
                    <p className="mute">
                      {VISIBILITY_LABELS[p.visibility]?.label} · 방명록 {p.guestbook_mode === 'off' ? '끔' : p.guestbook_mode === 'approval' ? '승인제' : '바로 공개'}
                    </p>
                    <div className="my-page-acts">
                      <Link className="btn-s solid" href={`/my/page/${p.id}`}>
                        꾸미기 · 관리
                      </Link>
                      {myQr && (
                        <Link className="btn-s" href={`/c/${myQr.id}`}>
                          방문자 화면 보기
                        </Link>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="my-sec">
          <h2>내 케이스</h2>
          {(qrs ?? []).length === 0 ? (
            <p className="mute">등록된 케이스가 없어요.</p>
          ) : (
            <ul className="my-list">
              {(qrs ?? []).map((q) => (
                <li key={q.id} className="my-qr">
                  <div className="my-qr-head">
                    <span className="mono">{q.id}</span>
                    <span>{LINE_NAME[q.line as Line]}</span>
                    <span className={`pill ${q.lost_mode ? 'warn' : 'ok'}`}>{q.lost_mode ? '분실 모드' : q.status === 'active' ? '사용 중' : q.status}</span>
                  </div>
                  <form action={setLostMode} className="my-lost-form">
                    <input type="hidden" name="qr" value={q.id} />
                    <input type="hidden" name="on" value={q.lost_mode ? '0' : '1'} />
                    {!q.lost_mode && (
                      <input name="note" maxLength={200} defaultValue={q.lost_note ?? ''} placeholder="습득자에게 보일 한마디 (예: 찾아주시면 사례할게요)" aria-label="습득자에게 보일 한마디" />
                    )}
                    <button type="submit" className={`btn-s ${q.lost_mode ? 'solid' : 'warn'}`}>
                      {q.lost_mode ? '찾았어요! 분실 모드 끄기' : '잃어버렸어요 · 분실 모드 켜기'}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(inquiries ?? []).length > 0 && (
          <section className="my-sec">
            <h2>내 문의</h2>
            <ul className="my-list">
              {(inquiries ?? []).map((q) => (
                <li key={q.id}>
                  <p>{q.body}</p>
                  {q.reply ? <p className="reply">답변: {q.reply}</p> : <p className="mute">답변을 준비하고 있어요 · {ago(q.created_at)}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="my-sec">
          <h2>계정</h2>
          <form action={updateNickname} className="inline-form">
            <input name="nickname" maxLength={20} defaultValue={profile.nickname ?? ''} aria-label="닉네임" />
            <button className="btn-s" type="submit">
              닉네임 저장
            </button>
          </form>
          <p className="mute small">
            로그인: {user.email ?? '카카오'}
            {user.email && (
              <>
                {' · '}
                <a href="/account/password">비밀번호 바꾸기</a>
              </>
            )}
          </p>
          <DeleteAccount />
        </section>
      </main>
    </div>
  )
}
