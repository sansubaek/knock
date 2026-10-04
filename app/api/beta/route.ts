import { NextResponse, type NextRequest } from 'next/server'
import { submitBeta } from '@/lib/forms'

// 정적 홈페이지(home.html)의 베타 신청 폼이 여기로 보낸다
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 400 })
  }
  const origin = req.headers.get('origin')
  if (origin && new URL(origin).host !== req.nextUrl.host) {
    return NextResponse.json({ ok: false, message: '잘못된 요청이에요.' }, { status: 403 })
  }
  const res = await submitBeta({ get: (k: string) => (typeof body[k] === 'boolean' ? (body[k] ? 'on' : '') : body[k]) })
  return NextResponse.json(res, { status: res.ok ? 200 : 400 })
}
