import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Supabase 무료 플랜은 7일 동안 요청이 없으면 프로젝트를 멈춘다.
// Vercel Cron이 하루 한 번 이 주소를 불러서 DB에 가벼운 조회를 한 번 보낸다. (vercel.json 의 crons)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  try {
    const db = createAdminClient()
    const { count, error } = await db.from('qr_codes').select('id', { count: 'exact', head: true })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, qr: count ?? 0, at: new Date().toISOString() })
  } catch (e) {
    console.error('keepalive', e)
    return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 500 })
  }
}