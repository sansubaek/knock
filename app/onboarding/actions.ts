'use server'

import { redirect } from 'next/navigation'
import { getSession, safeNext } from '@/lib/auth'
import { str } from '@/lib/content'

export async function finishOnboarding(_prev: { message: string }, form: FormData) {
  const nickname = str(form.get('nickname'), 20).trim()
  const over14 = form.get('over14') === 'on'
  const agree = form.get('agree') === 'on'
  const next = safeNext(String(form.get('next') ?? ''))
  if (!nickname) return { message: '닉네임을 적어주세요.' }
  if (!over14) return { message: 'knock은 만 14세 이상부터 가입할 수 있어요.' }
  if (!agree) return { message: '이용약관과 개인정보처리방침에 동의해 주세요.' }
  const { supabase, user } = await getSession()
  if (!user) redirect('/login')
  const { error } = await supabase.from('profiles').update({ nickname, is_over_14: true }).eq('id', user.id)
  if (error) return { message: '저장하지 못했어요. 다시 해주세요.' }
  redirect(next)
}
