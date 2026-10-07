'use client'

import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/browser'

// 비밀번호 찾기 메일의 링크가 도착하는 곳. 주소 뒤(#)에 붙은 일회용 로그인 정보로
// 로그인시킨 다음 비밀번호 만들기 화면으로 보낸다.
export function Recovery() {
  const [fail, setFail] = useState(false)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const access_token = hash.get('access_token')
    const refresh_token = hash.get('refresh_token')
    // 주소창에 남은 로그인 정보는 바로 지운다
    window.history.replaceState(null, '', window.location.pathname)
    if (!access_token || !refresh_token) {
      setFail(true)
      return
    }
    getBrowserClient()
      .auth.setSession({ access_token, refresh_token })
      .then((res: { error: unknown }) => {
        if (res.error) setFail(true)
        else window.location.replace('/account/password')
      })
  }, [])

  if (!fail) {
    return (
      <>
        <h1>확인하는 중이에요</h1>
        <p className="auth-p">잠시만요, 비밀번호 만들기 화면으로 넘어가요.</p>
      </>
    )
  }
  return (
    <>
      <h1>링크가 만료됐어요</h1>
      <p className="auth-p">비밀번호 찾기 링크는 한 번만, 1시간 안에 쓸 수 있어요. 새 메일을 받아서 가장 최근 링크를 눌러주세요.</p>
      <a className="auth-btn" href="/login">
        비밀번호 찾기 다시 하기
      </a>
    </>
  )
}
