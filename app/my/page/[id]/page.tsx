import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Editor } from './Editor'
import { requireMember } from '@/lib/auth'
import type { Line } from '@/lib/content'

export const metadata: Metadata = { title: '꾸미기 · knock' }
export const dynamic = 'force-dynamic'

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { id } = await params
  const { welcome } = await searchParams
  const { supabase, user } = await requireMember(`/my/page/${id}`)

  const { data: page } = await supabase
    .from('pages')
    .select('id, owner_id, line, template, theme, visibility, guestbook_mode, lock_pin_hash')
    .eq('id', id)
    .maybeSingle()
  if (!page || page.owner_id !== user.id) notFound()

  const [{ data: blocks }, { data: decor }, { data: guestbook }, { data: cards }, { data: qrs }, { count: knocks }] = await Promise.all([
    supabase.from('blocks').select('id, type, data, is_visible, position').eq('page_id', id).order('position'),
    supabase.from('decor_items').select('item_key, x, y, rotation, scale, z').eq('page_id', id).order('z'),
    supabase.from('guestbook_entries').select('id, nickname, message, status, created_at').eq('page_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('received_cards').select('id, name, org, contact, memo, created_at').eq('page_id', id).order('created_at', { ascending: false }).limit(200),
    supabase.from('qr_codes').select('id').eq('page_id', id).eq('status', 'active'),
    supabase.from('knocks').select('id', { count: 'exact', head: true }).eq('page_id', id),
  ])

  return (
    <Editor
      userId={user.id}
      welcome={welcome === '1'}
      page={{
        id: page.id,
        line: page.line as Line,
        template: page.template,
        theme: (page.theme ?? {}) as Record<string, unknown>,
        visibility: page.visibility,
        guestbook_mode: page.guestbook_mode ?? 'open',
        hasPin: !!page.lock_pin_hash,
      }}
      initialBlocks={(blocks ?? []).map((b) => ({ id: b.id, type: b.type, data: (b.data ?? {}) as Record<string, unknown>, is_visible: b.is_visible }))}
      initialDecor={(decor ?? []).map((d) => ({ item: d.item_key, x: d.x, y: d.y, rotation: d.rotation, scale: d.scale, z: d.z }))}
      guestbook={guestbook ?? []}
      cards={cards ?? []}
      qrIds={(qrs ?? []).map((q) => q.id)}
      knockCount={knocks ?? 0}
    />
  )
}
