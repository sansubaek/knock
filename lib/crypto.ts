import 'server-only'
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'

// 헷갈리는 글자 0 O 1 I L 제외. DB 체크와 같은 집합: A-H J K M N P-Z 2-9
export const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const QR_ID_RE = /^[A-HJKMNP-Z2-9]{6,8}$/

function secret(name: 'KNOCK_CODE_SECRET' | 'VISITOR_HASH_SALT') {
  const v = process.env[name]
  if (!v || v.length < 16) throw new Error(`${name}가 없거나 너무 짧습니다 (16자 이상)`)
  return v
}

export function newQrId(length = 6) {
  let s = ''
  for (let i = 0; i < length; i++) s += ID_ALPHABET[randomInt(ID_ALPHABET.length)]
  return s
}

const WEAK = new Set(['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321', '012345', '543210', '121212', '112233', '123123', '696969'])

/** 쉬운 번호를 뺀 6자리 활성화 코드 */
export function newActivationCode() {
  for (;;) {
    const c = String(randomInt(0, 1_000_000)).padStart(6, '0')
    if (WEAK.has(c)) continue
    // 같은 숫자 4개 이상 연속 금지
    if (/(\d)\1{3}/.test(c)) continue
    return c
  }
}

export function hmacCode(code: string) {
  return createHmac('sha256', secret('KNOCK_CODE_SECRET')).update(code).digest('hex')
}

export function codeMatches(code: string, storedHmac: string) {
  const a = Buffer.from(hmacCode(code), 'hex')
  const b = Buffer.from(storedHmac, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** 암호 잠금 해제 쿠키: 암호 자체가 아니라 서명만 저장. 주인이 암호를 바꾸면 자동으로 무효 */
export function signUnlock(qrId: string, pinHash: string, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const sig = createHmac('sha256', secret('KNOCK_CODE_SECRET')).update(`unlock|${qrId}|${exp}|${pinHash}`).digest('hex')
  return `${exp}.${sig}`
}

export function verifyUnlock(token: string, qrId: string, pinHash: string) {
  const [expStr, sig] = token.split('.')
  const exp = Number(expStr)
  if (!exp || !sig || exp < Date.now() / 1000) return false
  const want = createHmac('sha256', secret('KNOCK_CODE_SECRET')).update(`unlock|${qrId}|${exp}|${pinHash}`).digest('hex')
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(want, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** 도배 방지용 키: IP만 쓴다 (브라우저 정보는 바꿔치기 쉬움) */
export function ipKey(ip: string) {
  return createHash('sha256').update(`${secret('VISITOR_HASH_SALT')}|ip|${ip}`).digest('hex').slice(0, 32)
}

/** 방문자 해시: 원본 IP는 저장하지 않는다 */
export function visitorHash(ip: string, ua: string) {
  return createHash('sha256').update(`${secret('VISITOR_HASH_SALT')}|${ip}|${ua}`).digest('hex').slice(0, 32)
}

/** 테마 투표용: 브라우저 쿠키의 무작위 값을 되돌릴 수 없게 바꾼 값 */
export function voteHash(raw: string) {
  return createHash('sha256').update(`${secret('VISITOR_HASH_SALT')}|vote|${raw}`).digest('hex').slice(0, 32)
}
