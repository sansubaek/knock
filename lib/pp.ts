import 'server-only'
import { randomUUID } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { getTemplate } from '@/lib/content'
import { codeMatches, hmacCode } from '@/lib/crypto'
import { PEAPOD_TEST_IDS, peapodCodeMatches } from '@/lib/peapod-test'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PeaPod 정식 구조의 서버 쪽 (2026-11-25).
 * - 케이스: 기존 qr_codes 표를 그대로 쓴다 (주인 owner_id, 등록 시각 code_used_at).
 * - 계정: 기존 Supabase Auth + profiles (닉네임, 만 14세 확인).
 * - 방: 3D 방 상태(JSON)를 gzip 해서 blocks 표에 숨김 블록(type 'pp_state')으로 나눠 담는다.
 *   blocks.data 는 16KB 제한이 있어서 9,000자씩 자른다. 새 표를 만들 수 있게 되면 전용 표로 옮긴다.
 */

type Db = ReturnType<typeof createAdminClient>

export const PP_ID_RE = /^[A-HJKMNP-Z2-9]{6}$/
const NICK_RE = /^[가-힣a-zA-Z0-9]{2,10}$/
const RESERVED = ['운영자', '관리자', '운영팀', '피팟', 'peapod', 'admin', 'root', 'system', '손님']

// 2차 실물 테스트 케이스 6개의 방 테마 (qr_codes 에는 테마 칸이 없다)
const TEST_THEME: Record<string, string> = {
  '2UG37J': 'sunset',
  '857MJ2': 'sunset',
  NZWXKN: 'doodle',
  WSFRSU: 'doodle',
  U2J6JT: 'door',
  C8KT6P: 'door',
  Y6ZCN9: 'doodle',
  BQ5H2G: 'doodle',
}

export function ppId(raw: unknown) {
  const s = String(raw ?? '').trim().toUpperCase()
  return PP_ID_RE.test(s) ? s : null
}

export function ppTheme(id: string): string | null {
  return TEST_THEME[id] ?? null
}

export function nickErr(n: string) {
  if (!NICK_RE.test(n)) return '한글·영문·숫자만, 2~10자로 지어 주세요.'
  const lo = n.toLowerCase()
  if (RESERVED.some((w) => lo.includes(w))) return '그 이름은 쓸 수 없어요.'
  return ''
}

export type CaseRow = {
  id: string
  status: string
  owner_id: string | null
  page_id: string | null
  code_hmac: string
  code_used_at: string | null
}

const CASE_COLS = 'id, status, owner_id, page_id, code_hmac, code_used_at'

/** 케이스 한 줄. 2차 테스트 케이스는 처음 찍힐 때 줄을 만든다. */
export async function caseRow(db: Db, id: string): Promise<CaseRow | null> {
  const { data } = await db.from('qr_codes').select(CASE_COLS).eq('id', id).maybeSingle()
  if (data) return data as CaseRow
  if (!PEAPOD_TEST_IDS.has(id)) return null
  // 테스트 케이스의 코드 확인은 lib/peapod-test 목록으로 한다. code_hmac 에는 아무도 모르는 값을 넣어 둔다.
  await db.from('qr_codes').insert({ id, line: 'bang', code_hmac: hmacCode(randomUUID()) })
  const { data: again } = await db.from('qr_codes').select(CASE_COLS).eq('id', id).maybeSingle()
  return (again as CaseRow | null) ?? null
}

export function caseCodeOk(row: CaseRow, code: string) {
  return PEAPOD_TEST_IDS.has(row.id) ? peapodCodeMatches(row.id, code) : codeMatches(code, row.code_hmac)
}

async function pageOf(db: Db, userId: string): Promise<string | null> {
  const { data } = await db.from('pages').select('id').eq('owner_id', userId).eq('line', 'bang').order('created_at').limit(1)
  return data && data.length ? (data[0].id as string) : null
}

export async function ensurePage(db: Db, userId: string): Promise<string | null> {
  const have = await pageOf(db, userId)
  if (have) return have
  const { data } = await db
    .from('pages')
    .insert({ owner_id: userId, line: 'bang', template: getTemplate('bang', null).key })
    .select('id')
    .single()
  return (data?.id as string | undefined) ?? null
}

const CHUNK = 9000
const MAX_JSON = 600_000

type Part = { v: number; i: number; n: number; z: string }

export async function loadState(db: Db, userId: string): Promise<{ state: Record<string, unknown> | null; at: number | null; pageId: string | null }> {
  const pageId = await pageOf(db, userId)
  if (!pageId) return { state: null, at: null, pageId: null }
  const { data } = await db.from('blocks').select('data').eq('page_id', pageId).eq('type', 'pp_state')
  const byV = new Map<number, Part[]>()
  for (const r of data ?? []) {
    const d = r.data as Partial<Part> | null
    if (!d || typeof d.v !== 'number' || typeof d.i !== 'number' || typeof d.n !== 'number' || typeof d.z !== 'string') continue
    const arr = byV.get(d.v) ?? []
    arr.push(d as Part)
    byV.set(d.v, arr)
  }
  const versions = [...byV.keys()].sort((a, b) => b - a)
  for (const v of versions) {
    const parts = byV.get(v)!
    const n = parts[0].n
    if (parts.length !== n) continue // 올리다 만 것은 건너뛴다
    try {
      const z = parts.sort((a, b) => a.i - b.i).map((p) => p.z).join('')
      const json = gunzipSync(Buffer.from(z, 'base64'), { maxOutputLength: MAX_JSON * 4 }).toString('utf8')
      const state = JSON.parse(json)
      if (state && typeof state === 'object' && !Array.isArray(state)) return { state, at: v, pageId }
    } catch {
      // 깨진 판은 건너뛰고 그 전 판을 본다
    }
  }
  return { state: null, at: null, pageId }
}

export async function saveState(db: Db, userId: string, state: unknown): Promise<{ ok: boolean; msg?: string }> {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, msg: '잘못된 요청이에요.' }
  let json = ''
  try {
    json = JSON.stringify(state)
  } catch {
    return { ok: false, msg: '잘못된 요청이에요.' }
  }
  if (json.length > MAX_JSON) return { ok: false, msg: '방에 담긴 것이 너무 많아요.' }
  const z = gzipSync(Buffer.from(json, 'utf8')).toString('base64')
  const n = Math.ceil(z.length / CHUNK)
  if (n > 40) return { ok: false, msg: '방에 담긴 것이 너무 많아요.' }
  const pageId = await ensurePage(db, userId)
  if (!pageId) return { ok: false, msg: '저장하지 못했어요.' }
  const v = Date.now()
  const rows = Array.from({ length: n }, (_, i) => ({
    page_id: pageId,
    type: 'pp_state',
    position: 9000 + i,
    is_visible: false,
    data: { v, i, n, z: z.slice(i * CHUNK, (i + 1) * CHUNK) },
  }))
  const { error } = await db.from('blocks').insert(rows)
  if (error) return { ok: false, msg: '저장하지 못했어요.' }
  // 새 판이 다 들어간 뒤에 옛 판을 지운다
  await db.from('blocks').delete().eq('page_id', pageId).eq('type', 'pp_state').neq('data->>v', String(v))
  return { ok: true }
}

/** 손님에게 보여 줄 만큼만 고른다. 편지·코인·커플룸 같은 건 내보내지 않는다. */
export function ownerView(state: Record<string, unknown> | null) {
  const s = (state ?? {}) as Record<string, any>
  const set = s.set && typeof s.set === 'object' ? s.set : {}
  const room = s.room && typeof s.room === 'object' ? s.room : null
  return {
    vis: set.vis === 'me' ? 'me' : set.vis === 'all' ? 'all' : 'friends',
    lost: set.lost && set.lost.on ? String(set.lost.msg ?? '').slice(0, 80) : null,
    look: s.look && typeof s.look === 'object' ? s.look : null,
    status: typeof s.status === 'string' ? s.status.slice(0, 20) : 'rest',
    room: room
      ? {
          wall: room.wall,
          floor: room.floor,
          spot: room.spot,
          items: Array.isArray(room.items) ? room.items.slice(0, 120) : [],
          deco: Array.isArray(room.deco) ? room.deco.slice(0, 60) : [],
          notes: Array.isArray(room.notes) ? room.notes.slice(0, 40) : [],
          theme: room.theme ?? null,
          pet: room.pet ?? undefined,
        }
      : null,
  }
}

/** 한국 날짜의 오늘 0시 (UTC 시각 문자열) */
export function kstDayStart() {
  const now = new Date(Date.now() + 9 * 3600e3)
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 9 * 3600e3
  return new Date(start).toISOString()
}
