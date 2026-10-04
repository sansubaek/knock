import 'server-only'

import { getSession } from '@/lib/auth'
import { str } from '@/lib/content'
import { hit } from '@/lib/ratelimit'
import { requestInfo } from '@/lib/request'
import { createAdminClient } from '@/lib/supabase/admin'

export type FormState = { ok: boolean; message: string }

export async function submitBeta(form: { get(k: string): unknown }): Promise<FormState> {
  if (String(form.get('website') ?? '')) return { ok: true, message: '신청을 받았어요.' }
  const line = form.get('line') === 'dot' ? 'dot' : 'bang'
  const name = str(form.get('name'), 30).trim()
  const contact = str(form.get('contact'), 80).trim()
  const design = str(form.get('design'), 60).trim()
  const phone = str(form.get('phone'), 40).trim()
  const agree = form.get('agree') === 'on'
  if (!name || !contact) return { ok: false, message: '이름과 연락받을 곳을 적어주세요.' }
  if (!agree) return { ok: false, message: '개인정보 수집·이용에 동의해 주세요.' }
  const { rl } = await requestInfo()
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  if (!(await hit(`beta:${rl}`, 3, 3600)) || !(await hit(`betaall:${day}`, 500, 86400))) return { ok: false, message: '잠시 뒤에 다시 신청해 주세요.' }
  const { user } = await getSession()
  const db = createAdminClient()
  const { error } = await db.from('orders').insert({
    kind: 'beta',
    user_id: user?.id ?? null,
    applicant_name: name,
    contact,
    line,
    design: design || null,
    phone_model: phone || null,
  })
  if (error) return { ok: false, message: '저장하지 못했어요. 잠시 뒤에 다시 해주세요.' }
  return { ok: true, message: '신청을 받았어요! 선정되면 남겨주신 연락처로 알려드릴게요.' }
}

const TYPES = ['general', 'code', 'report', 'lost', 'other'] as const

export async function submitInquiry(form: { get(k: string): unknown }): Promise<FormState> {
  if (String(form.get('website') ?? '')) return { ok: true, message: '문의를 받았어요.' }
  const t = String(form.get('type') ?? 'general')
  const type = (TYPES as readonly string[]).includes(t) ? t : 'general'
  const email = str(form.get('email'), 120).trim()
  const body = str(form.get('body'), 2000).trim()
  const target = str(form.get('target'), 40).trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: '답장 받을 이메일을 정확히 적어주세요.' }
  if (!body) return { ok: false, message: '내용을 적어주세요.' }
  const { rl } = await requestInfo()
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  if (!(await hit(`inq:${rl}`, 5, 3600)) || !(await hit(`inqall:${day}`, 300, 86400))) return { ok: false, message: '잠시 뒤에 다시 보내주세요.' }
  const { user } = await getSession()
  const db = createAdminClient()
  const { error } = await db.from('inquiries').insert({
    user_id: user?.id ?? null,
    email,
    type,
    target_type: target ? 'qr' : null,
    target_id: target || null,
    body,
  })
  if (error) return { ok: false, message: '보내지 못했어요. 잠시 뒤에 다시 해주세요.' }
  return { ok: true, message: '문의를 받았어요. 보통 1~2일 안에 이메일로 답장드려요.' }
}
