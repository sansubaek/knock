import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { PageView } from '@/components/PageView'
import { ActivateForm, LostForm, UnlockForm } from '@/components/visitor'
import { getSession } from '@/lib/auth'
import { loadPublic, normalizeQrId, qrOwner } from '@/lib/public-page'
import { requestInfo } from '@/lib/request'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'knock',
  robots: { index: false, follow: false },
}

function Shell({ line, children }: { line: 'bang' | 'dot'; children: React.ReactNode }) {
  return (
    <div className={`gate gate-${line}`}>
      <div className="gate-card">
        <p className="gate-brand">{line === 'dot' ? 'knock.' : 'knock!'}</p>
        {children}
      </div>
    </div>
  )
}

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params
  const id = normalizeQrId(raw)
  if (!id) return <NotFound />
  if (raw !== id) redirect(`/c/${id}`)

  const [res, session, owner, req] = await Promise.all([loadPublic(id), getSession(), qrOwner(id), requestInfo()])
  const isOwner = !!session.user && owner?.owner_id === session.user.id

  if (res.state !== 'not_found') {
    after(async () => {
      try {
        await createAdminClient()
          .from('scan_logs')
          .insert({ qr_id: id, visitor_hash: req.visitor, is_owner: isOwner, user_agent: req.ua.slice(0, 200), result: res.state })
      } catch (e) {
        console.error('scan log', e)
      }
    })
  }

  const ownerBar = (text: string, href = '/my', cta = '관리하기') =>
    isOwner ? (
      <div className="owner-bar">
        <span>{text}</span>
        <Link href={href}>{cta}</Link>
      </div>
    ) : null

  switch (res.state) {
    case 'not_found':
      return <NotFound />

    case 'activate': {
      if (session.user && !session.profile?.is_over_14) redirect(`/onboarding?next=/c/${id}`)
      return (
        <Shell line={res.line}>
          <h1 className="gate-h">새 케이스가 도착했어요</h1>
          {session.user ? (
            <>
              <p className="gate-p">상자 안 카드에 적힌 6자리 숫자를 넣으면 이 케이스가 내 것이 돼요. 코드는 한 번 쓰면 사라져요.</p>
              <ActivateForm qrId={id} />
              <p className="gate-small">
                카드를 잃어버렸나요? <Link href={`/support?type=code&target=${id}`}>코드 재발급 요청</Link>
              </p>
            </>
          ) : (
            <>
              <p className="gate-p">이 케이스는 아직 주인이 없어요. 케이스를 받은 분이라면 가입(또는 로그인)한 뒤 카드의 6자리 코드로 문을 열어주세요.</p>
              <Link className="gate-btn" href={`/signup?next=/c/${id}`}>
                가입하고 등록하기
              </Link>
              <p className="gate-small">
                이미 계정이 있나요? <Link href={`/login?next=/c/${id}`}>로그인하고 등록하기</Link>
              </p>
              <p className="gate-small">
                주운 케이스라면 <Link href={`/support?type=lost&target=${id}`}>여기로 알려주세요</Link>.
              </p>
            </>
          )}
        </Shell>
      )
    }

    case 'lost':
      return (
        <Shell line={res.line}>
          {ownerBar('분실 모드가 켜져 있어요', '/my', '끄러 가기')}
          <span className="gate-badge">분실 모드</span>
          <h1 className="gate-h">이 폰의 주인을 찾고 있어요</h1>
          <p className="gate-p">찍어주셔서 고마워요. 아래에 한마디만 남겨주시면 주인에게 바로 전달돼요. 앱 설치도, 로그인도 필요 없어요.</p>
          {res.lost_note && <blockquote className="lost-note">“{res.lost_note}”</blockquote>}
          <LostForm qrId={id} />
        </Shell>
      )

    case 'private':
      return (
        <Shell line={res.line}>
          {ownerBar('비공개로 설정돼 있어요', '/my', '설정 바꾸기')}
          <h1 className="gate-h">지금은 비공개예요</h1>
          <p className="gate-p">주인이 페이지를 잠시 닫아뒀어요. 다음에 다시 찍어주세요.</p>
          <Link className="gate-link" href="/">
            knock 둘러보기
          </Link>
        </Shell>
      )

    case 'locked':
      return (
        <Shell line={res.line}>
          {ownerBar('암호 잠금 상태예요', '/my', '설정 바꾸기')}
          <h1 className="gate-h">암호를 아는 사람만 들어올 수 있어요</h1>
          <p className="gate-p">주인에게 받은 숫자 암호를 넣어주세요.</p>
          <UnlockForm qrId={id} />
        </Shell>
      )

    case 'page':
      return (
        <PageView
          data={res}
          qrId={id}
          banner={
            isOwner && owner?.page_id ? (
              <div className="owner-bar floating">
                <span>내 페이지예요</span>
                <Link href={`/my/page/${owner.page_id}`}>꾸미기</Link>
              </div>
            ) : null
          }
        />
      )
  }
}

function NotFound() {
  return (
    <div className="gate gate-bang">
      <div className="gate-card">
        <p className="gate-brand">knock</p>
        <h1 className="gate-h">없는 케이스 주소예요</h1>
        <p className="gate-p">QR이 긁혔거나 주소가 잘못 입력됐을 수 있어요.</p>
        <Link className="gate-link" href="/">
          knock 홈으로
        </Link>
      </div>
    </div>
  )
}
