import { NextResponse, type NextRequest } from 'next/server'

// 비밀번호 찾기·로그인 링크가 어디서 막히는지 보기 위한 임시 기록.
// 로그인 정보(토큰)는 받지 않는다. 문제 해결되면 지운다.
const STAGES = new Set(['home_forward', 'link_error', 'no_token', 'got_token', 'set_session_error', 'set_session_throw', 'ok'])

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    if (raw.length > 2000) return new NextResponse(null, { status: 204 })
    const j = JSON.parse(raw) as { stage?: string; detail?: string; ua?: string }
    if (!j.stage || !STAGES.has(j.stage)) return new NextResponse(null, { status: 204 })
    console.log('[auth-debug]', j.stage, String(j.detail ?? '').slice(0, 200), '|', String(j.ua ?? '').slice(0, 160))
  } catch {}
  return new NextResponse(null, { status: 204 })
}
