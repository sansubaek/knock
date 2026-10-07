'use client'
import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

let client: ReturnType<typeof createBrowserClient> | null = null

export function getBrowserClient() {
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

/**
 * 비밀번호 찾기 메일 전용. 메일을 다른 앱(네이버 메일 앱 등)에서 열어도 되도록
 * 링크에 일회용 로그인 정보가 바로 담기는 방식(implicit)으로 보낸다.
 */
export async function sendRecoveryMail(email: string) {
  const { createClient } = await import('@supabase/supabase-js')
  const once = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return once.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/recovery` })
}
