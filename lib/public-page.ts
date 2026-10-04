import 'server-only'
import { cookies } from 'next/headers'
import { QR_ID_RE } from '@/lib/crypto'
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
  | { state: 'locked'; line: Line }
  | ({ state: 'page' } & PageData)

export function normalizeQrId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim().toUpperCase()
  return QR_ID_RE.test(id) ? id : null
}

export const pinCookieName = (id: string) => `kp_${id}`

export async function loadPublic(id: string, pinOverride?: string): Promise<PublicResult> {
  const jar = await cookies()
  const pin = pinOverride ?? jar.get(pinCookieName(id))?.value ?? null
  const db = createAdminClient()
  const { data, error } = await db.rpc('get_public_page', { p_qr_id: id, p_pin: pin })
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
