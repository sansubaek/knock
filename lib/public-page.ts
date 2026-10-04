import 'server-only'
import { cookies } from 'next/headers'
import { QR_ID_RE, verifyUnlock } from '@/lib/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Block, Decor, Line } from '@/lib/content'

export type GuestEntry = { nickname: string; message: string; at: string }

export type PageData = {
  page_id?: string
  line: Line
  template: string
  theme: Record<string, unknown>
  guestbook_mode: 'open' | 'approval' | 'off'
  blocks: Block[]
  decor: Decor[]
  guestbook: GuestEntry[]
  knock_count: number
  today_visits: number
  total_visits: number
}

export type PublicResult =
  | { state: 'not_found' }
  | { state: 'activate'; line: Line }
  | { state: 'lost'; line: Line; lost_note: string | null }
  | { state: 'private'; line: Line }
  | { state: 'locked'; line: Line; page_id?: string }
  | ({ state: 'page' } & PageData)

export function normalizeQrId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim().toUpperCase()
  return QR_ID_RE.test(id) ? id : null
}

export const pinCookieName = (id: string) => `kp_${id}`

/** 이 QR 페이지의 암호 해시 (잠금 해제 쿠키 서명에 쓴다) */
export async function pinHashFor(id: string) {
  const db = createAdminClient()
  const { data: q } = await db.from('qr_codes').select('page_id').eq('id', id).maybeSingle()
  if (!q?.page_id) return null
  const { data: p } = await db.from('pages').select('lock_pin_hash').eq('id', q.page_id).maybeSingle()
  return (p?.lock_pin_hash as string | null) ?? null
}

/**
 * 방문자용 페이지 조회. pin은 암호 입력 직후 확인할 때만 넘긴다.
 * 평소에는 서명된 쿠키가 맞는지 서버가 확인하고, 쿠키 값으로 암호를 대입해 볼 수는 없다.
 */
export async function loadPublic(id: string, pin?: string): Promise<PublicResult> {
  const jar = await cookies()
  let unlocked = false
  const token = jar.get(pinCookieName(id))?.value
  if (!pin && token) {
    const hash = await pinHashFor(id)
    unlocked = !!hash && verifyUnlock(token, id, hash)
  }
  const db = createAdminClient()
  const { data, error } = await db.rpc('get_public_page', { p_qr_id: id, p_pin: pin ?? null, p_unlocked: unlocked })
  if (error) {
    console.error('get_public_page', error.message)
    throw new Error('페이지를 불러오지 못했어요')
  }
  return data as PublicResult
}

/** QR의 주인 정보 (방문 기록의 is_owner, 주인 전용 안내에 사용) */
export async function qrOwner(id: string) {
  const db = createAdminClient()
  const { data } = await db.from('qr_codes').select('owner_id, page_id, lost_mode').eq('id', id).maybeSingle()
  return data as { owner_id: string | null; page_id: string | null; lost_mode: boolean } | null
}

export function kstDate() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}
