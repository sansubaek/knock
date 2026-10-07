import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { hit } from '@/lib/ratelimit'
import { SITE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

// 임시: 관리자 계정으로 비밀번호 찾기 메일을 한 통 보내 메일 연결을 시험한다.
// 사이트의 '비밀번호 찾기'와 같은 일을 하고, 받는 사람은 관리자로 고정. 시험 끝나면 지운다.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get('mode')
  if (!(await hit(mode === 'code' ? 'authcode' : 'authtest', 3, 3600))) return NextResponse.json({ ok: false, error: 'rate' })
  const db = createAdminClient()
  const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin').limit(1)
  const id = admins?.[0]?.id
  if (!id) return NextResponse.json({ ok: false, error: 'no admin' })
  const { data: u } = await db.auth.admin.getUserById(id)
  const email = u.user?.email
  if (!email) return NextResponse.json({ ok: false, error: 'no email' })
  if (mode === 'code') {
    // 메일을 보내지 않고 일회용 코드만 만들어 서버 전용 표에 보관한다 (응답에는 코드를 넣지 않음)
    const { data: link, error: le } = await db.auth.admin.generateLink({ type: 'recovery', email })
    const code = link?.properties?.email_otp
    if (le || !code) return NextResponse.json({ ok: false, error: le?.message ?? 'no code' })
    await db.from('ops_login_codes').insert({ code })
    return NextResponse.json({ ok: true, stored: true })
  }
  const once = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await once.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/recovery` })
  return NextResponse.json({ ok: !error, error: error?.message ?? null, to: email.replace(/^(.{2}).*(@.*)$/, '$1***$2') })
}
