import { NextResponse, type NextRequest } from 'next/server'
import { hit } from '@/lib/ratelimit'
import { requestInfo } from '@/lib/request'
import { PEAPOD_TEST_IDS, peapodCodeMatches } from '@/lib/peapod-test'

// 새 PeaPod 흐름(/peapod/index.html)의 '카드 6자리 코드' 확인. 2차 테스트 케이스 전용.
// 코드는 브라우저에 없고 여기서만 비교한다. 틀린 횟수는 IP와 케이스 기준으로 센다.
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin && new URL(origin).host !== req.nextUrl.host) {
    return NextResponse.json({ ok: false, msg: '잘못된 요청이에요.' }, { status: 403 })
  }
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, msg: '잘못된 요청이에요.' }, { status: 400 })
  }
  const id = String(body.c ?? '').toUpperCase()
  const code = String(body.code ?? '').replace(/\D/g, '')
  if (!PEAPOD_TEST_IDS.has(id)) return NextResponse.json({ ok: false, msg: '등록할 수 없는 케이스예요.' }, { status: 404 })
  if (code.length !== 6) return NextResponse.json({ ok: false, msg: '숫자 6자리를 모두 입력해 주세요.' }, { status: 400 })

  const { rl } = await requestInfo()
  if (!(await hit(`ppc:${id}:${rl}`, 5, 900))) return NextResponse.json({ ok: false, wait: 900, msg: '여러 번 틀렸어요. 15분 뒤에 다시 해 주세요.' }, { status: 429 })
  if (!(await hit(`ppcd:${id}`, 40, 86400))) return NextResponse.json({ ok: false, msg: '오늘은 더 시도할 수 없어요. 내일 다시 해 주세요.' }, { status: 429 })

  if (!peapodCodeMatches(id, code)) return NextResponse.json({ ok: false, msg: '코드가 맞지 않아요. 카드의 숫자를 다시 확인해 주세요.' })
  return NextResponse.json({ ok: true })
}
