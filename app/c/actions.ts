'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { codeMatches, signUnlock } from '@/lib/crypto'
import { defaultBlocks, getTemplate, str, type Line } from '@/lib/content'
import { getSession } from '@/lib/auth'
import { hit } from '@/lib/ratelimit'
import { requestInfo } from '@/lib/request'
import { kstDate, loadPublic, normalizeQrId, pinCookieName, pinHashFor } from '@/lib/public-page'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionState = { ok: boolean; message: string; at?: number }

const fail = (message: string): ActionState => ({ ok: false, message, at: Date.now() })
const done = (message: string): ActionState => ({ ok: true, message, at: Date.now() })

// ── 활성화: 카드의 6자리 코드로 케이스를 내 것으로 ──────────────

export async function activateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = normalizeQrId(form.get('qr'))
  const code = String(form.get('code') ?? '').replace(/\D/g, '')
  if (!id) return fail('케이스 주소가 올바르지 않아요.')
  if (code.length !== 6) return fail('카드에 적힌 6자리 숫자를 모두 넣어주세요.')

  const { user, profile } = await getSession()
  if (!user) return fail('먼저 로그인해 주세요.')
  if (!profile?.is_over_14) return fail('첫 설정(닉네임, 나이 확인)을 먼저 마쳐주세요.')

  const db = createAdminClient()
  const { data: q } = await db
    .from('qr_codes')
    .select('id, line, status, code_hmac, code_used_at, failed_attempts, locked_until, owner_id, order_id')
    .eq('id', id)
    .maybeSingle()

  if (!q || q.status === 'retired') return fail('등록할 수 없는 케이스예요. 문의하기로 알려주세요.')
  if (q.code_used_at || q.status === 'active') {
    if (q.owner_id === user.id) redirect('/my')
    return fail('이미 다른 계정에 등록된 케이스예요. 내 케이스가 맞다면 문의하기로 알려주세요.')
  }
  // 잠금은 계정별로 건다. 남이 일부러 틀려서 진짜 주인을 막지 못하게
  const failKey = `actf:${id}:${user.id}`
  const db2 = db
  const { data: fails } = await db2.rpc('rate_limit_count', { p_key: failKey })
  if ((fails ?? 0) >= 5) return fail('5번 틀려서 15분 동안 잠겼어요. 카드의 숫자를 다시 확인하고 잠시 뒤에 해주세요.')
  if (!(await hit(`act:${id}:${user.id}:${kstDate()}`, 20, 86400))) return fail('오늘은 더 시도할 수 없어요. 내일 다시 해주세요.')
  if (!(await hit(`actq:${id}:${kstDate()}`, 200, 86400))) return fail('지금은 이 케이스를 등록할 수 없어요. 문의하기로 알려주세요.')
  if (!(await hit(`actu:${user.id}`, 30, 3600))) return fail('잠시 뒤에 다시 해주세요.')

  if (!codeMatches(code, q.code_hmac)) {
    await hit(failKey, 1000, 900)
    await db2.rpc('bump_failed_attempts', { p_id: id })
    const used = (fails ?? 0) + 1
    return fail(used >= 5 ? '5번 틀려서 15분 동안 잠겼어요. 카드의 숫자를 다시 확인해 주세요.' : `코드가 맞지 않아요. ${5 - used}번 더 시도할 수 있어요.`)
  }

  // 같은 라인의 내 페이지가 있으면 거기에 연결, 없으면 새로 만든다
  const line = q.line as Line
  let pageId: string | null = null
  const { data: existing } = await db
    .from('pages')
    .select('id')
    .eq('owner_id', user.id)
    .eq('line', line)
    .order('created_at')
    .limit(1)
  if (existing && existing.length) {
    pageId = existing[0].id
  } else {
    const { data: created, error } = await db
      .from('pages')
      .insert({ owner_id: user.id, line, template: getTemplate(line, null).key })
      .select('id')
      .single()
    if (error || !created) return fail('페이지를 만들지 못했어요. 잠시 뒤에 다시 해주세요.')
    pageId = created.id
    const blocks = defaultBlocks(line, profile.nickname).map((b, i) => ({ page_id: pageId, type: b.type, data: b.data, position: i }))
    await db.from('blocks').insert(blocks)
  }

  // 동시에 두 사람이 넣어도 한 명만 성공하게 code_used_at이 비어 있을 때만 갱신
  const { data: claimed } = await db
    .from('qr_codes')
    .update({
      status: 'active',
      owner_id: user.id,
      page_id: pageId,
      code_used_at: new Date().toISOString(),
      locked_until: null,
    })
    .eq('id', id)
    .is('code_used_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) return fail('이미 등록된 케이스예요.')

  if (q.order_id) await db.from('orders').update({ status: 'activated' }).eq('id', q.order_id)

  redirect(`/my/page/${pageId}?welcome=1`)
}

// ── 암호 잠금 해제 ──────────────────────────────

export async function unlockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = normalizeQrId(form.get('qr'))
  const pin = String(form.get('pin') ?? '').replace(/\D/g, '')
  if (!id) return fail('잘못된 주소예요.')
  if (pin.length < 4 || pin.length > 6) return fail('숫자 4~6자리를 넣어주세요.')
  const { rl } = await requestInfo()
  // 방문자당 15분 5번, QR당 15분 10번·하루 30번. 4자리 암호도 무작위로 맞히려면 수개월이 걸린다
  if (!(await hit(`pinv:${rl}`, 5, 900)) || !(await hit(`pin:${id}`, 10, 900)) || !(await hit(`pind:${id}:${kstDate()}`, 30, 86400))) {
    return fail('여러 번 틀려서 잠시 막혔어요. 15분 뒤에 다시 해주세요.')
  }
  const res = await loadPublic(id, pin)
  if (res.state !== 'page') return fail('암호가 맞지 않아요.')
  const hash = await pinHashFor(id)
  if (!hash) return fail('암호가 맞지 않아요.')
  const jar = await cookies()
  jar.set(pinCookieName(id), signUnlock(id, hash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/c/${id}`,
    maxAge: 3600,
  })
  redirect(`/c/${id}`)
}

// ── 방문자 쓰기: 노크, 방명록, 명함 교환, 분실 메시지 ──────────

async function openPage(id: string) {
  const res = await loadPublic(id)
  if (res.state !== 'page' || !res.page_id) return null
  return res
}

export async function knockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = normalizeQrId(form.get('qr'))
  if (!id) return fail('잘못된 주소예요.')
  const page = await openPage(id)
  if (!page) return fail('지금은 노크할 수 없어요.')
  const { visitor, rl } = await requestInfo()
  if (!(await hit(`knock:${page.page_id}:${rl}`, 1, 3600))) return done('이미 노크했어요. 한 시간 뒤에 또 두드려 주세요.')
  if (!(await hit(`knockp:${page.page_id}:${kstDate()}`, 300, 86400))) return done('오늘은 노크가 너무 많아요. 내일 또 와주세요!')
  const db = createAdminClient()
  const { error } = await db.from('knocks').insert({ page_id: page.page_id, visitor_hash: visitor })
  if (error) return fail('노크가 전달되지 않았어요.')
  return done('똑똑! 노크를 남겼어요.')
}

export async function guestbookAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = normalizeQrId(form.get('qr'))
  const nickname = str(form.get('nickname'), 12).trim()
  const message = str(form.get('message'), 200).trim()
  if (!id) return fail('잘못된 주소예요.')
  if (!nickname || !message) return fail('닉네임과 한마디를 적어주세요.')
  if (String(form.get('website') ?? '')) return done('남겼어요!') // 봇 함정 칸
  const page = await openPage(id)
  if (!page || page.guestbook_mode === 'off') return fail('이 페이지는 방명록을 받지 않아요.')
  const { visitor, rl } = await requestInfo()
  if (!(await hit(`gb:${rl}`, 3, 600)) || !(await hit(`gbp:${page.page_id}`, 60, 86400))) {
    return fail('조금 있다가 다시 남겨주세요.')
  }
  const status = page.guestbook_mode === 'approval' ? 'pending' : 'visible'
  const db = createAdminClient()
  const { error } = await db.from('guestbook_entries').insert({ page_id: page.page_id, nickname, message, status, visitor_hash: visitor })
  if (error) return fail('저장하지 못했어요.')
  return done(status === 'pending' ? '남겼어요! 주인이 확인하면 보여요.' : '방명록을 남겼어요!')
}

export async function cardAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = normalizeQrId(form.get('qr'))
  const name = str(form.get('name'), 30).trim()
  const org = str(form.get('org'), 40).trim()
  const contact = str(form.get('contact'), 60).trim()
  const memo = str(form.get('memo'), 60).trim()
  if (!id) return fail('잘못된 주소예요.')
  if (!name || !contact) return fail('이름과 연락처를 적어주세요.')
  if (String(form.get('website') ?? '')) return done('명함을 전달했어요.')
  const page = await openPage(id)
  if (!page || page.line !== 'dot') return fail('명함을 받을 수 없는 페이지예요.')
  const { rl } = await requestInfo()
  if (!(await hit(`card:${rl}`, 5, 3600)) || !(await hit(`cardp:${page.page_id}:${kstDate()}`, 50, 86400))) return fail('잠시 뒤에 다시 해주세요.')
  const db = createAdminClient()
  const { error } = await db.from('received_cards').insert({ page_id: page.page_id, name, org: org || null, contact, memo: memo || null })
  if (error) return fail('전달하지 못했어요.')
  return done('명함을 전달했어요. 곧 연락이 갈 거예요.')
}

export async function lostMessageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = normalizeQrId(form.get('qr'))
  const message = str(form.get('message'), 300).trim()
  const finder = str(form.get('contact'), 60).trim()
  const location = str(form.get('location'), 100).trim()
  if (!id) return fail('잘못된 주소예요.')
  if (!message) return fail('주인에게 남길 말을 적어주세요.')
  if (String(form.get('website') ?? '')) return done('전달했어요. 감사합니다!')
  const res = await loadPublic(id)
  if (res.state !== 'lost') return fail('지금은 분실 모드가 아니에요.')
  const { rl } = await requestInfo()
  if (!(await hit(`lost:${rl}`, 5, 3600)) || !(await hit(`lostq:${id}:${kstDate()}`, 50, 86400))) return fail('잠시 뒤에 다시 해주세요.')
  const db = createAdminClient()
  const { error } = await db.from('lost_messages').insert({
    qr_id: id,
    message,
    finder_contact: finder || null,
    location_note: location || null,
  })
  if (error) return fail('전달하지 못했어요. 다시 한번 눌러주세요.')
  return done('주인에게 전달했어요. 찾아주셔서 정말 고마워요!')
}
