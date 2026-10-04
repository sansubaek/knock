'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { str } from '@/lib/content'
import { createAdminClient } from '@/lib/supabase/admin'

export async function setLostMode(form: FormData) {
  const qr = String(form.get('qr') ?? '')
  const on = form.get('on') === '1'
  const note = str(form.get('note'), 200).trim()
  const { supabase, user } = await getSession()
  if (!user) redirect('/login?next=/my')
  // RLS와 컬럼 권한 때문에 내 QR의 lost_mode, lost_note만 바뀐다
  // 끌 때는 적어둔 한마디를 지우지 않는다
  await supabase.from('qr_codes').update(on ? { lost_mode: true, lost_note: note || null } : { lost_mode: false }).eq('id', qr)
  revalidatePath('/my')
}

export async function updateNickname(form: FormData) {
  const nickname = str(form.get('nickname'), 20).trim()
  const { supabase, user } = await getSession()
  if (!user || !nickname) return
  await supabase.from('profiles').update({ nickname }).eq('id', user.id)
  revalidatePath('/my')
}

export async function deleteAccount(_prev: { message: string }, form: FormData) {
  if (String(form.get('confirm') ?? '').trim() !== '탈퇴') return { message: '확인란에 "탈퇴"라고 적어주세요.' }
  const { supabase, user } = await getSession()
  if (!user) redirect('/login')
  const admin = createAdminClient()
  // 1) 내 사진 파일 삭제
  const { data: files } = await admin.storage.from('page-media').list(user.id, { limit: 1000 })
  if (files && files.length) await admin.storage.from('page-media').remove(files.map((f) => `${user.id}/${f.name}`))
  // 2) 내 QR은 주인 없음 + 폐기 처리 (다른 사람이 재사용하지 못하게)
  await admin.from('qr_codes').update({ status: 'retired', lost_mode: false }).eq('owner_id', user.id)
  // 3) 계정 삭제 → profiles, pages, blocks, 방명록 등은 DB에서 연쇄 삭제
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return { message: '탈퇴 처리 중 문제가 생겼어요. 문의하기로 알려주세요.' }
  await supabase.auth.signOut()
  redirect('/?bye=1')
}
