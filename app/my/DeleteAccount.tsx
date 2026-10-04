'use client'

import { useActionState, useState } from 'react'
import { deleteAccount } from './actions'

export function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(deleteAccount, { message: '' })
  if (!open) {
    return (
      <button type="button" className="link-btn danger" onClick={() => setOpen(true)}>
        회원 탈퇴
      </button>
    )
  }
  return (
    <form action={action} className="danger-box">
      <p>
        탈퇴하면 페이지, 방명록, 받은 명함, 사진이 모두 지워지고 되돌릴 수 없어요. 등록한 케이스의 QR은 더 이상 열리지 않아요.
      </p>
      <input name="confirm" placeholder='"탈퇴"라고 적어주세요' aria-label="확인" />
      <button type="submit" className="btn-s warn" disabled={pending}>
        {pending ? '처리 중…' : '탈퇴하기'}
      </button>
      {state.message && <p className="v-msg err">{state.message}</p>}
    </form>
  )
}
