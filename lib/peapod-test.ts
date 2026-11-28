import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

// PeaPod 2차 실물 테스트 케이스 6개 (2026-11-25) + 개인 버전 2개 (2026-11-29).
// 이 QR들은 /c/<id> 에서 새 PeaPod 흐름(/peapod/index.html)으로 넘어간다.
// 등록 코드 원문은 저장하지 않고, 소금 친 SHA-256 값만 둔다. 서버 연결(정식 qr_codes)로 옮기면 지운다.
const SALT = '91f9f338d9ad71bd6af85c8a39a04b08'
const HASHES: Record<string, string> = {
  '2UG37J': 'f07dcdaa8a334f76556e0e69770077752293abf1606235c6451e8b2fcfdd6dbd', // 물감파도
  '857MJ2': '06db1d5e1c839a7043099a15b6fdea6a1759066da2f89476485651724e1558cc', // 큰체리
  'NZWXKN': '649d4b4baa5cb888f36be2619e382e828a50bd90f413616eedf099336c71cfdf', // 혼잣말칠판
  'WSFRSU': '7491120b6a6d93e17435a485c0cd06645f2e6adab4b1f03a7778cc025a333ba2', // 할일없음
  'U2J6JT': 'a1f51263995e434ea874af48d0c7505647db0b63771d884de69f9a1ab7ca9a82', // 진주새틴
  'C8KT6P': 'daae83f22ff53ef009de75af2c34cba57c5e4c22e442f0d5d42f2514d7637455', // 신문냥
  'Y6ZCN9': 'c27ab89d2c810772648ba9e425f9d16802a725639894905b299a792d8485c487', // 할일없음 개인(성규)
  'BQ5H2G': 'bc68d24e228d60d22da7bf117aa302f70a5a552af80ed32e204647ee1fb8aedd', // 할일없음 개인(승재)
}

export const PEAPOD_TEST_IDS = new Set(Object.keys(HASHES))

export function peapodCodeMatches(id: string, code: string) {
  const want = HASHES[id]
  if (!want) return false
  const got = createHash('sha256').update(`${SALT}:${id}:${code}`).digest()
  const exp = Buffer.from(want, 'hex')
  return got.length === exp.length && timingSafeEqual(got, exp)
}
