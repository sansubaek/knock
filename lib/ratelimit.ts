import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/** 허용 범위 안이면 true. DB 오류가 나면 안전하게 막는다(false). */
export async function hit(key: string, limit: number, windowSeconds: number) {
  const db = createAdminClient()
  const { data, error } = await db.rpc('hit_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error('rate limit error', error.message)
    return false
  }
  return data === true
}
