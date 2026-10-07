import 'server-only'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { voteHash } from '@/lib/crypto'
import { hit } from '@/lib/ratelimit'
import { requestInfo } from '@/lib/request'
import { createAdminClient } from '@/lib/supabase/admin'
import { AGE_BANDS, MAX_PICKS, THEMES, VOTE_OPEN, type Line } from '@/lib/vote'

export const VOTE_COOKIE = 'knock_vid'

export type VoteState = { ok: boolean; message: string; saved?: { bang: number; dot: number } }
export type MyVotes = { bang: number[]; dot: number[]; age: string | null }

/** 쿠키가 이미 있으면 그 사람의 투표 해시. 없으면 null (읽기 전용) */
export async function currentVoter() {
  const raw = (await cookies()).get(VOTE_COOKIE)?.value
  return raw && /^[a-f0-9]{32}$/.test(raw) ? voteHash(raw) : null
}

export async function myVotes(): Promise<MyVotes> {
  const voter = await currentVoter()
  const empty: MyVotes = { bang: [], dot: [], age: null }
  if (!voter) return empty
  const { data } = await createAdminClient().from('theme_votes').select('line, picks, age_band').eq('voter', voter)
  for (const r of data ?? []) {
    if (r.line === 'bang' || r.line === 'dot') empty[r.line as Line] = (r.picks as number[]) ?? []
    if (r.age_band) empty.age = r.age_band
  }
  return empty
}

function parsePicks(v: unknown, line: Line): number[] | null {
  const s = String(v ?? '').trim()
  if (!s) return []
  const max = THEMES[line].length
  const nums = s.split(',').map((x) => Number(x))
  if (nums.length > MAX_PICKS) return null
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > max)) return null
  if (new Set(nums).size !== nums.length) return null
  return nums
}

export async function submitVote(form: FormData): Promise<VoteState> {
  if (!VOTE_OPEN) return { ok: false, message: '투표가 끝났어요. 참여해 주셔서 고마워요.' }
  if (String(form.get('website') ?? '')) return { ok: true, message: '투표를 받았어요.' }
  const bang = parsePicks(form.get('bang'), 'bang')
  const dot = parsePicks(form.get('dot'), 'dot')
  if (!bang || !dot) return { ok: false, message: '고른 테마를 다시 확인해 주세요.' }
  if (!bang.length && !dot.length) return { ok: false, message: '마음에 드는 테마를 하나 이상 골라주세요.' }
  const a = String(form.get('age') ?? '')
  const age = AGE_BANDS.some((b) => b.key === a) ? a : null

  const { rl } = await requestInfo()
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  if (!(await hit(`vote:${rl}`, 20, 3600)) || !(await hit(`voteall:${day}`, 5000, 86400))) {
    return { ok: false, message: '잠시 뒤에 다시 제출해 주세요.' }
  }

  // 브라우저마다 무작위 값 하나. 이름·연락처·원본 IP는 저장하지 않는다
  const jar = await cookies()
  let raw = jar.get(VOTE_COOKIE)?.value
  if (!raw || !/^[a-f0-9]{32}$/.test(raw)) {
    raw = randomBytes(16).toString('hex')
    jar.set(VOTE_COOKIE, raw, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365, path: '/' })
  }
  const voter = voteHash(raw)
  const db = createAdminClient()
  const now = new Date().toISOString()

  for (const [line, picks] of [['bang', bang], ['dot', dot]] as const) {
    if (picks.length) {
      const { error } = await db
        .from('theme_votes')
        .upsert({ line, picks, age_band: age, voter, net: rl, updated_at: now }, { onConflict: 'line,voter' })
      if (error) {
        console.error('vote save', error.message)
        return { ok: false, message: '저장하지 못했어요. 잠시 뒤에 다시 해주세요.' }
      }
    } else {
      // 이번에 한 개도 안 고른 쪽은 예전 투표를 지운다 (화면에서 다 뺀 경우)
      await db.from('theme_votes').delete().eq('line', line).eq('voter', voter)
    }
  }
  return { ok: true, message: '투표를 받았어요! 고마워요.', saved: { bang: bang.length, dot: dot.length } }
}
