'use client'

import { keepForm } from '@/components/keepForm'
import { useActionState } from 'react'
import { finishOnboarding } from './actions'

export function OnboardingForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(finishOnboarding, { message: '' })
  return (
    <form onSubmit={keepForm(action)} className="auth-form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="nickname">닉네임</label>
      <input id="nickname" name="nickname" maxLength={20} required placeholder="페이지에 처음 보일 이름" />
      <label className="check">
        <input type="checkbox" name="over14" /> 만 14세 이상이에요
      </label>
      <label className="check">
        <input type="checkbox" name="agree" />
        <span>
          <a href="/terms" target="_blank">
            이용약관
          </a>
          과{' '}
          <a href="/privacy" target="_blank">
            개인정보처리방침
          </a>
          에 동의해요
        </span>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? '저장 중…' : '시작하기'}
      </button>
      {state.message && <p className="v-msg err">{state.message}</p>}
    </form>
  )
}
