import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  nickname: string | null
  role: 'user' | 'admin'
  is_over_14: boolean
  created_at: string
}

export async function getSession() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return { supabase, user: null, profile: null as Profile | null }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return { supabase, user, profile: (profile as Profile | null) ?? null }
}

/** 로그인 + 첫 설정(닉네임, 만 14세 확인)까지 끝난 사용자만 통과 */
export async function requireMember(next: string) {
  const s = await getSession()
  if (!s.user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!s.profile?.is_over_14) redirect(`/onboarding?next=${encodeURIComponent(next)}`)
  return s as typeof s & { user: NonNullable<typeof s.user>; profile: Profile }
}

export async function requireAdmin() {
  const s = await requireMember('/admin')
  if (s.profile.role !== 'admin') redirect('/my')
  return s
}

/** 외부 주소로 튕겨 나가지 않게 next 값을 검사 */
export function safeNext(next: string | null | undefined, fallback = '/my') {
  if (!next || !next.startsWith('/') || /[\x00-\x20\\]/.test(next)) return fallback
  try {
    const base = 'https://knock.invalid'
    const u = new URL(next, base)
    if (u.origin !== base) return fallback
    return u.pathname + u.search
  } catch {
    return fallback
  }
}
