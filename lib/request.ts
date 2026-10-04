import 'server-only'
import { headers } from 'next/headers'
import { visitorHash } from '@/lib/crypto'

export async function requestInfo() {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '0.0.0.0'
  const ua = (h.get('user-agent') ?? '').slice(0, 300)
  return { ip, ua, visitor: visitorHash(ip, ua) }
}
