import 'server-only'
import { headers } from 'next/headers'
import { ipKey, visitorHash } from '@/lib/crypto'

export async function requestInfo() {
  const h = await headers()
  // Vercel은 x-real-ip를 직접 채워준다 (사용자가 바꿀 수 없음)
  const ip = h.get('x-real-ip') || (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0'
  const ua = (h.get('user-agent') ?? '').slice(0, 300)
  return { ip, ua, visitor: visitorHash(ip, ua), rl: ipKey(ip) }
}
