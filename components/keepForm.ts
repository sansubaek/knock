'use client'

import { startTransition, type FormEvent } from 'react'

/**
 * React 19는 form action이 끝나면 입력칸을 비운다. 오류가 났을 때 다시 쓰지 않게,
 * 기본 제출을 막고 직접 action을 부른다.
 */
export function keepForm(action: (fd: FormData) => void, disabled = false) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (disabled) return
    const fd = new FormData(e.currentTarget)
    startTransition(() => action(fd))
  }
}
