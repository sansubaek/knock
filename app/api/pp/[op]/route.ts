import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { PEAPOD_TEST_IDS } from '@/lib/peapod-test'
import { caseCodeOk, caseRow, ensurePage, kstDayStart, loadState, nickErr, ownerView, ppId, ppTheme, saveState } from '@/lib/pp'
import { hit } from '@/lib/ratelimit'
import { requestInfo } from '@/lib/request'
import { createAdminClient } from '@/lib/supabase/admin'

// PeaPod 방 앱(/room)이 쓰는 서버 창구. 한 파일에서 op 로 나눈다.
//   GET  boot?c=ID  로그인 여부·내 방·찍힌 케이스 상태
//   POST auth       가입 / 메일 코드 확인 / 로그인 / 로그아웃
//   POST profile    방 주인 이름 + 만 14세 확인
//   POST claim      카드 6자리 코드로 케이스 등록
//   POST state      방 저장
//   POST found      주운 케이스 알리기
//   POST knock      다녀간 흔적
//   POST delete     계정 삭제

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ op: string }> }

const J = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
const NO = (msg: string, status = 400, extra: Record<string, unknown> = {}) => J({ ok: false, msg, ...extra }, status)

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === req.nextUrl.host
  } catch {
    return false
  }
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { op } = await params
  if (op !== 'boot') return NO('없는 주소예요.', 404)
  const { rl, visitor, ua } = await requestInfo()
  if (!(await hit(`ppb:${rl}`, 240, 600))) return NO('잠시 뒤에 다시 해 주세요.', 429)

  const { user, profile } = await getSession()
  const db = createAdminClient()

  let me: Record<string, unknown> | null = null
  if (user) {
    const [st, mineRes] = await Promise.all([
      loadState(db, user.id),
      db.from('qr_codes').select('id, code_used_at').eq('owner_id', user.id).eq('status', 'active').order('code_used_at'),
    ])
    const mine = (mineRes.data ?? []) as { id: string; code_used_at: string | null }[]
    const ids = mine.map((m) => m.id)
    let scans = 0
    let knocks = 0
    let found: { t: string; c: string; at: number }[] = []
    if (ids.length) {
      const since = kstDayStart()
      const [sc, lm] = await Promise.all([
        db.from('scan_logs').select('id', { count: 'exact', head: true }).in('qr_id', ids).eq('is_owner', false).gte('scanned_at', since),
        db
          .from('lost_messages')
          .select('qr_id, message, created_at')
          .in('qr_id', ids)
          .gte('created_at', new Date(Date.now() - 14 * 86400e3).toISOString())
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      scans = sc.count ?? 0
      found = (lm.data ?? []).map((m) => ({ t: String(m.message), c: String(m.qr_id), at: Date.parse(String(m.created_at)) }))
      if (st.pageId) {
        const kn = await db.from('knocks').select('id', { count: 'exact', head: true }).eq('page_id', st.pageId).gte('created_at', since)
        knocks = kn.count ?? 0
      }
    }
    me = {
      nick: profile?.nickname ?? null,
      cases: mine.map((m) => ({ code: m.id, theme: ppTheme(m.id), at: m.code_used_at ? Date.parse(m.code_used_at) : Date.now() })),
      state: st.state,
      at: st.at,
      scans,
      knocks,
      found,
    }
  }

  let cs: Record<string, unknown> | null = null
  const raw = req.nextUrl.searchParams.get('c')
  if (raw) {
    const id = ppId(raw)
    const row = id ? await caseRow(db, id) : null
    if (!id || !row || row.status === 'retired') {
      cs = { code: id, state: 'unknown' }
    } else {
      let result: 'activate' | 'page' | 'locked' | 'lost' = 'page'
      const isOwner = !!user && row.owner_id === user.id
      if (!row.owner_id) {
        cs = { code: id, state: 'new', theme: ppTheme(id) }
        result = 'activate'
      } else if (isOwner) {
        cs = { code: id, state: 'mine', theme: ppTheme(id) }
      } else {
        const [st, prof] = await Promise.all([
          loadState(db, row.owner_id),
          db.from('profiles').select('nickname').eq('id', row.owner_id).maybeSingle(),
        ])
        const v = ownerView(st.state)
        const nick = (prof.data?.nickname as string | null) ?? null
        if (v.lost !== null) {
          cs = { code: id, state: 'lost', msg: v.lost, owner: { nick } }
          result = 'lost'
        } else if (v.vis === 'me') {
          cs = { code: id, state: 'locked', owner: { nick } }
          result = 'locked'
        } else {
          cs = { code: id, state: 'owned', owner: { nick, look: v.look, status: v.status, room: v.room } }
        }
      }
      try {
        await db.from('scan_logs').insert({ qr_id: id, visitor_hash: visitor, is_owner: isOwner, user_agent: ua.slice(0, 200), result })
      } catch {
        // 기록 실패는 무시
      }
    }
  }

  return J({ ok: true, me, case: cs })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { op } = await params
  if (!sameOrigin(req)) return NO('잘못된 요청이에요.', 403)
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return NO('잘못된 요청이에요.', 415)
  let text = ''
  try {
    text = await req.text()
  } catch {
    return NO('잘못된 요청이에요.')
  }
  if (text.length > 900_000) return NO('보낸 내용이 너무 커요.', 413)
  let body: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(text || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed
  } catch {
    return NO('잘못된 요청이에요.')
  }
  const { rl, visitor } = await requestInfo()

  // ── 계정 ──
  if (op === 'auth') {
    const mode = String(body.mode ?? '')
    const { supabase, user } = await getSession()
    if (mode === 'logout') {
      await supabase.auth.signOut()
      return J({ ok: true })
    }
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]{1,64}@[^\s@]{1,80}\.[^\s@]{2,}$/.test(email) || email.length > 120) return NO('이메일 주소를 확인해 주세요.')
    if (mode === 'verify') {
      const token = String(body.token ?? '').replace(/\D/g, '')
      if (token.length < 6 || token.length > 8) return NO('메일에 온 숫자를 그대로 넣어 주세요.')
      if (!(await hit(`ppv:${rl}`, 10, 900))) return NO('여러 번 틀렸어요. 15분 뒤에 다시 해 주세요.', 429)
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
      if (error) return NO(/expired|invalid/i.test(error.message) ? '코드가 맞지 않거나 시간이 지났어요. 가장 최근 메일의 숫자를 넣어 주세요.' : '확인하지 못했어요. 잠시 뒤에 다시 해 주세요.')
      return J({ ok: true })
    }
    const password = String(body.password ?? '')
    if (password.length < 8 || password.length > 72) return NO('비밀번호는 8자 이상으로 해 주세요.')
    if (mode === 'signup') {
      if (user) return J({ ok: true })
      if (!(await hit(`ppsu:${rl}`, 8, 3600))) return NO('잠시 뒤에 다시 해 주세요.', 429)
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        if (/registered|exists/i.test(error.message)) return NO('이미 가입된 이메일이에요. 로그인해 주세요.')
        if (/password/i.test(error.message)) return NO('비밀번호가 너무 쉬워요. 다른 비밀번호로 해 주세요.')
        if (/rate|seconds/i.test(error.message)) return NO('메일을 너무 자주 보냈어요. 잠시 뒤에 다시 해 주세요.', 429)
        return NO('가입하지 못했어요. 이메일 주소를 확인해 주세요.')
      }
      if (data.user && data.user.identities && data.user.identities.length === 0) return NO('이미 가입된 이메일이에요. 로그인해 주세요.')
      return J(data.session ? { ok: true } : { ok: true, needCode: true })
    }
    if (mode === 'login') {
      if (!(await hit(`ppli:${rl}`, 10, 900))) return NO('여러 번 틀렸어요. 15분 뒤에 다시 해 주세요.', 429)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          await supabase.auth.resend({ type: 'signup', email })
          return J({ ok: true, needCode: true })
        }
        return NO('이메일이나 비밀번호가 맞지 않아요.')
      }
      return J({ ok: true })
    }
    return NO('잘못된 요청이에요.')
  }

  // ── 주운 케이스 알리기 (로그인 없이) ──
  if (op === 'found') {
    const id = ppId(body.c)
    const msg = String(body.msg ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (!id || msg.length < 4) return NO('조금만 더 자세히 적어 주세요.')
    if (!(await hit(`ppf:${rl}`, 5, 3600))) return NO('잠시 뒤에 다시 해 주세요.', 429)
    const db = createAdminClient()
    const row = await caseRow(db, id)
    if (!row) return NO('등록되지 않은 케이스예요.', 404)
    const { error } = await db.from('lost_messages').insert({ qr_id: id, message: msg })
    if (error) return NO('보내지 못했어요. 잠시 뒤에 다시 해 주세요.', 500)
    return J({ ok: true })
  }

  // ── 다녀간 흔적 (로그인 없이) ──
  if (op === 'knock') {
    const id = ppId(body.c)
    if (!id) return NO('잘못된 요청이에요.')
    const db = createAdminClient()
    const row = await caseRow(db, id)
    if (!row || !row.owner_id || !row.page_id) return J({ ok: true })
    if (!(await hit(`ppk:${row.page_id}:${rl}`, 1, 3600))) return J({ ok: true })
    if (!(await hit(`ppkd:${row.page_id}`, 500, 86400))) return J({ ok: true })
    await db.from('knocks').insert({ page_id: row.page_id, visitor_hash: visitor })
    return J({ ok: true })
  }

  // ── 여기부터 로그인 필요 ──
  const { supabase, user } = await getSession()
  if (!user) return NO('먼저 로그인해 주세요.', 401, { auth: 0 })
  const db = createAdminClient()

  if (op === 'profile') {
    const nick = String(body.nick ?? '').normalize('NFC').trim()
    const e = nickErr(nick)
    if (e) return NO(e)
    if (!(await hit(`ppp:${user.id}`, 30, 3600))) return NO('잠시 뒤에 다시 해 주세요.', 429)
    const { error } = await supabase.from('profiles').update({ nickname: nick, is_over_14: true }).eq('id', user.id)
    if (error) return NO('이름을 저장하지 못했어요.', 500)
    return J({ ok: true })
  }

  if (op === 'claim') {
    const id = ppId(body.c)
    const code = String(body.code ?? '').replace(/\D/g, '')
    if (!id) return NO('케이스 주소가 올바르지 않아요.')
    if (code.length !== 6) return NO('숫자 6자리를 모두 입력해 주세요.')
    const row = await caseRow(db, id)
    if (!row || row.status === 'retired') return NO('등록할 수 없는 케이스예요.', 404)
    if (row.owner_id) {
      if (row.owner_id === user.id) return J({ ok: true, theme: ppTheme(id) })
      return NO('이미 다른 계정에 등록된 케이스예요.')
    }
    if (!(await hit(`ppc:${id}:${user.id}`, 5, 900))) return NO('여러 번 틀렸어요. 15분 뒤에 다시 해 주세요.', 429, { wait: 900 })
    if (!(await hit(`ppcq:${id}`, 60, 86400))) return NO('오늘은 이 케이스를 더 시도할 수 없어요. 내일 다시 해 주세요.', 429)
    if (!caseCodeOk(row, code)) return NO('코드가 맞지 않아요. 카드의 숫자를 다시 확인해 주세요.')
    const pageId = await ensurePage(db, user.id)
    if (!pageId) return NO('방을 만들지 못했어요. 잠시 뒤에 다시 해 주세요.', 500)
    // 동시에 두 사람이 넣어도 한 명만 성공하게, 주인이 비어 있을 때만 바꾼다
    const { data: claimed } = await db
      .from('qr_codes')
      .update({ status: 'active', owner_id: user.id, page_id: pageId, code_used_at: new Date().toISOString(), locked_until: null, failed_attempts: 0 })
      .eq('id', id)
      .is('owner_id', null)
      .select('id')
    if (!claimed || claimed.length === 0) return NO('이미 등록된 케이스예요.')
    return J({ ok: true, theme: ppTheme(id) })
  }

  if (op === 'state') {
    if (!(await hit(`pps:${user.id}`, 400, 3600))) return NO('잠시 뒤에 다시 해 주세요.', 429)
    const state = body.state as Record<string, unknown> | undefined
    const res = await saveState(db, user.id, state)
    if (!res.ok) return NO(res.msg ?? '저장하지 못했어요.')
    // 설정에서 이름을 바꿨으면 계정 이름도 맞춘다
    const me = state && typeof state.me === 'object' && state.me ? (state.me as Record<string, unknown>) : null
    const nick = me && typeof me.nick === 'string' ? me.nick.normalize('NFC').trim() : ''
    if (nick && !nickErr(nick)) await supabase.from('profiles').update({ nickname: nick }).eq('id', user.id).neq('nickname', nick)
    return J({ ok: true })
  }

  if (op === 'delete') {
    if (!(await hit(`ppd:${rl}`, 5, 3600))) return NO('잠시 뒤에 다시 해 주세요.', 429)
    // 등록한 케이스는 주인 없는 상태로 돌려서, 카드의 코드로 다시 등록할 수 있게 한다
    await db.from('qr_codes').update({ status: 'issued', owner_id: null, page_id: null, code_used_at: null, lost_mode: false }).eq('owner_id', user.id)
    try {
      const { data: files } = await db.storage.from('page-media').list(user.id, { limit: 1000 })
      if (files && files.length) await db.storage.from('page-media').remove(files.map((f) => `${user.id}/${f.name}`))
    } catch {
      // 사진이 없으면 넘어간다
    }
    const { error } = await db.auth.admin.deleteUser(user.id)
    if (error) return NO('삭제하지 못했어요. 잠시 뒤에 다시 해 주세요.', 500)
    await supabase.auth.signOut()
    return J({ ok: true })
  }

  return NO('없는 주소예요.', 404)
}
