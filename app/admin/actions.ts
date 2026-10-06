'use server'

import QRCode from 'qrcode'
import { revalidatePath } from 'next/cache'
import { adminOrThrow, log } from './guard'
import { hmacCode, newActivationCode, newQrId } from '@/lib/crypto'
import { str } from '@/lib/content'
import { qrUrl } from '@/lib/env'

export type IssuedItem = { id: string; line: 'bang' | 'dot'; code: string; url: string; svg: string; orderId?: string | null; label?: string }
export type IssueState = { ok: boolean; message: string; items: IssuedItem[] }

async function makeSvg(url: string) {
  return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
}

async function insertQr(db: Awaited<ReturnType<typeof adminOrThrow>>['db'], line: 'bang' | 'dot', orderId: string | null) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = newQrId(6)
    const code = newActivationCode()
    const { error } = await db.from('qr_codes').insert({ id, line, code_hmac: hmacCode(code), order_id: orderId })
    if (!error) {
      const url = qrUrl(id)
      const item: IssuedItem = { id, line, code, url, svg: await makeSvg(url), orderId }
      return item
    }
    if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message)
  }
  throw new Error('ID를 만들지 못했어요. 다시 시도해 주세요.')
}

export async function issueBatch(_prev: IssueState, form: FormData): Promise<IssueState> {
  try {
    const { user, db } = await adminOrThrow()
    const line = form.get('line') === 'dot' ? 'dot' : 'bang'
    const count = Math.max(1, Math.min(200, Number(form.get('count')) || 1))
    const items: IssuedItem[] = []
    for (let i = 0; i < count; i++) items.push(await insertQr(db, line, null))
    await log(db, user.id, 'qr.issue_batch', `${line} x${count}: ${items[0].id}…${items[items.length - 1].id}`)
    revalidatePath('/admin/qr')
    return { ok: true, message: `${count}개를 발급했어요. 코드는 지금 한 번만 보여요. CSV를 꼭 받아두세요.`, items }
  } catch (e) {
    return { ok: false, message: (e as Error).message, items: [] }
  }
}

export async function issueForOrder(_prev: IssueState, form: FormData): Promise<IssueState> {
  try {
    const { user, db } = await adminOrThrow()
    const orderId = String(form.get('order') ?? '')
    const { data: order } = await db.from('orders').select('id, line, applicant_name, design, phone_model, status').eq('id', orderId).maybeSingle()
    if (!order) return { ok: false, message: '주문을 찾지 못했어요.', items: [] }
    const item = await insertQr(db, order.line, order.id)
    item.label = [order.applicant_name, order.design, order.phone_model].filter(Boolean).join(' · ')
    await db.from('qr_codes').update({ status: 'printed' }).eq('id', item.id)
    if (order.status === 'received') await db.from('orders').update({ status: 'requested' }).eq('id', order.id)
    await log(db, user.id, 'order.issue_qr', `${order.id} → ${item.id}`)
    revalidatePath('/admin/orders')
    return { ok: true, message: `${item.id} 발급 완료. 제작 요청 상태로 바꿨어요.`, items: [item] }
  } catch (e) {
    return { ok: false, message: (e as Error).message, items: [] }
  }
}

export async function reissueCode(_prev: IssueState, form: FormData): Promise<IssueState> {
  try {
    const { user, db } = await adminOrThrow()
    const id = String(form.get('qr') ?? '').toUpperCase()
    const { data: q } = await db.from('qr_codes').select('id, line, code_used_at, status').eq('id', id).maybeSingle()
    if (!q) return { ok: false, message: '없는 QR이에요.', items: [] }
    if (q.code_used_at) return { ok: false, message: '이미 등록된 케이스는 코드를 다시 만들 수 없어요. 주인 이전이 필요하면 따로 처리해야 해요.', items: [] }
    const code = newActivationCode()
    await db.from('qr_codes').update({ code_hmac: hmacCode(code), failed_attempts: 0, locked_until: null }).eq('id', id)
    await log(db, user.id, 'qr.reissue_code', id)
    const url = qrUrl(id)
    return { ok: true, message: `${id}의 새 코드예요. 이전 코드는 이제 안 먹혀요.`, items: [{ id, line: q.line, code, url, svg: await makeSvg(url) }] }
  } catch (e) {
    return { ok: false, message: (e as Error).message, items: [] }
  }
}

export async function setQrStatus(form: FormData) {
  const { user, db } = await adminOrThrow()
  const id = String(form.get('qr') ?? '')
  const status = String(form.get('status') ?? '')
  if (!['issued', 'printed', 'retired'].includes(status)) return
  // 사용 중인 케이스는 여기서 폐기하지 않는다 (실수 방지)
  await db.from('qr_codes').update(status === 'retired' ? { status, lost_mode: false } : { status }).eq('id', id).neq('status', 'active')
  await log(db, user.id, `qr.status.${status}`, id)
  revalidatePath('/admin/qr')
}

export async function markPrinted(form: FormData) {
  const { user, db } = await adminOrThrow()
  const ids = String(form.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!ids.length) return
  await db.from('qr_codes').update({ status: 'printed' }).in('id', ids).eq('status', 'issued')
  await log(db, user.id, 'qr.mark_printed', ids.join(','))
  revalidatePath('/admin/qr')
}

const ORDER_STATUS = ['received', 'requested', 'producing', 'shipped', 'activated', 'canceled']

export async function updateOrder(form: FormData) {
  const { user, db } = await adminOrThrow()
  const id = String(form.get('order') ?? '')
  const status = String(form.get('status') ?? '')
  const memo = str(form.get('memo'), 500)
  const patch: Record<string, string> = { admin_memo: memo }
  if (ORDER_STATUS.includes(status)) patch.status = status
  await db.from('orders').update(patch).eq('id', id)
  await log(db, user.id, 'order.update', `${id} ${status}`)
  revalidatePath('/admin/orders')
}

export async function replyInquiry(form: FormData) {
  const { user, db } = await adminOrThrow()
  const id = String(form.get('id') ?? '')
  const reply = str(form.get('reply'), 2000).trim()
  const status = String(form.get('status') ?? 'answered')
  await db
    .from('inquiries')
    .update({ reply: reply || null, status: ['open', 'answered', 'closed'].includes(status) ? status : 'answered', replied_at: reply ? new Date().toISOString() : null })
    .eq('id', id)
  await log(db, user.id, 'inquiry.reply', id)
  revalidatePath('/admin/inquiries')
}

export async function hideGuestbook(form: FormData) {
  const { user, db } = await adminOrThrow()
  const id = String(form.get('id') ?? '')
  await db.from('guestbook_entries').update({ status: 'hidden' }).eq('id', id)
  await log(db, user.id, 'guestbook.hide', id)
}

export type BulkState = { ok: boolean; message: string }

function pickIds(form: FormData) {
  const only = String(form.get('only') ?? '').trim()
  const list = only ? [only] : form.getAll('ids').map((v) => String(v).trim())
  return [...new Set(list.filter((s) => /^[A-Z0-9]{4,10}$/.test(s)))].slice(0, 500)
}

/** 선택한 QR 완전 삭제. 고객이 등록한(사용 중인) QR은 절대 지우지 않는다. 스캔 기록도 같이 지워진다. */
export async function bulkDeleteQr(_prev: BulkState, form: FormData): Promise<BulkState> {
  try {
    const { user, db } = await adminOrThrow()
    const ids = pickIds(form)
    if (!ids.length) return { ok: false, message: '선택한 QR이 없어요.' }
    const { data, error } = await db
      .from('qr_codes')
      .delete()
      .in('id', ids)
      .neq('status', 'active')
      .is('owner_id', null)
      .is('code_used_at', null)
      .select('id')
    if (error) return { ok: false, message: `삭제하지 못했어요: ${error.message}` }
    const n = data?.length ?? 0
    if (n) await log(db, user.id, 'qr.delete', `${n}개: ${data!.map((r) => r.id).join(',')}`.slice(0, 1000))
    revalidatePath('/admin/qr')
    revalidatePath('/admin')
    const skipped = ids.length - n
    return { ok: true, message: `${n}개를 삭제했어요.${skipped ? ` 고객이 등록한 ${skipped}개는 지우지 않았어요.` : ''}` }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

/** 선택한 QR 폐기 (기록은 남기고 더 이상 못 쓰게). 사용 중인 QR은 건너뛴다. */
export async function bulkRetireQr(_prev: BulkState, form: FormData): Promise<BulkState> {
  try {
    const { user, db } = await adminOrThrow()
    const ids = pickIds(form)
    if (!ids.length) return { ok: false, message: '선택한 QR이 없어요.' }
    const { data, error } = await db
      .from('qr_codes')
      .update({ status: 'retired', lost_mode: false })
      .in('id', ids)
      .in('status', ['issued', 'printed'])
      .select('id')
    if (error) return { ok: false, message: `폐기하지 못했어요: ${error.message}` }
    const n = data?.length ?? 0
    if (n) await log(db, user.id, 'qr.status.retired', `${n}개: ${data!.map((r) => r.id).join(',')}`.slice(0, 1000))
    revalidatePath('/admin/qr')
    const skipped = ids.length - n
    return { ok: true, message: `${n}개를 폐기했어요.${skipped ? ` 이미 폐기됐거나 사용 중인 ${skipped}개는 그대로예요.` : ''}` }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}
