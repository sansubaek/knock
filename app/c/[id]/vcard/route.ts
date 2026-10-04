import { NextResponse, type NextRequest } from 'next/server'
import { str } from '@/lib/content'
import { loadPublic, normalizeQrId } from '@/lib/public-page'

export const dynamic = 'force-dynamic'

function esc(v: string) {
  return v.replace(/\\/g, '\\\\').replace(/\r?\n|\r/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params
  const id = normalizeQrId(raw)
  if (!id) return new NextResponse('not found', { status: 404 })
  const res = await loadPublic(id)
  if (res.state !== 'page' || res.line !== 'dot') return NextResponse.redirect(new URL(`/c/${id}`, _req.url))
  const card = res.blocks.find((b) => b.type === 'card')
  if (!card) return NextResponse.redirect(new URL(`/c/${id}`, _req.url))

  const g = (k: string, m = 200) => str(card.data?.[k], m).trim()
  const name = g('name', 20) || 'knock.'
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(name)};;;;`,
    `FN:${esc(name)}`,
    g('org', 40) && `ORG:${esc(g('org', 40))}`,
    g('title', 30) && `TITLE:${esc(g('title', 30))}`,
    g('phone', 20) && `TEL;TYPE=CELL:${esc(g('phone', 20))}`,
    g('email', 80) && `EMAIL;TYPE=INTERNET:${esc(g('email', 80))}`,
    g('website') && `URL:${esc(g('website'))}`,
    `NOTE:${esc('knock.으로 받은 명함')}`,
    'END:VCARD',
  ].filter(Boolean)

  return new NextResponse(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="knock-${id}.vcf"; filename*=UTF-8''${encodeURIComponent(name)}.vcf`,
      'Cache-Control': 'no-store',
    },
  })
}
