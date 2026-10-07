'use client'

import { useEffect, useRef, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/browser'

// 비밀번호 찾기 메일의 링크가 도착하는 곳. 주소 뒤(#)에 붙은 일회용 로그인 정보로
// 로그인시킨 다음 비밀번호 만들기 화면으로 보낸다.
// 실패하면 이유를 서버 로그로 남긴다 (로그인 정보 자체는 보내지 않음).

function report(stage: string, detail = '') {
  try {
    const body = JSON.stringify({ stage, detail: detail.slice(0, 200), ua: navigator.userAgent.slice(0, 160) })
    if (!navigator.sendBeacon?.('/api/auth-debug', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/auth-debug', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true })
    }
  } catch {}
}

export function Recovery() {
  const [fail, setFail] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const access_token = hash.get('access_token')
    const refresh_token = hash.get('refresh_token')
    const errCode = hash.get('error_code') || hash.get('error')
    // 주소창에 남은 로그인 정보는 바로 지운다
    window.history.replaceState(null, '', window.location.pathname)
    if (errCode) {
      report('link_error', errCode)
      setFail(errCode === 'otp_expired' ? 'used' : errCode)
      return
    }
    if (!access_token || !refresh_token) {
      report('no_token', `hash_keys=${[...hash.keys()].join(',')}`)
      setFail('no_token')
      return
    }
    report('got_token')
    getBrowserClient()
      .auth.setSession({ access_token, refresh_token })
      .then((res: { error: { message?: string } | null }) => {
        if (res.error) {
          report('set_session_error', res.error.message ?? 'unknown')
          setFail('session')
        } else {
          report('ok')
          window.location.replace('/account/password')
        }
      })
      .catch((e: unknown) => {
        report('set_session_throw', String(e))
        setFail('session')
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
      <h1>{fail === 'used' ? '이미 쓴 링크예요' : '링크를 열지 못했어요'}</h1>
      <p className="auth-p">
        {fail === 'used'
          ? '비밀번호 찾기 링크는 한 번만 열 수 있어요. 메일을 여러 번 받았다면 가장 최근 메일의 링크를 눌러주세요.'
          : '비밀번호 찾기를 다시 해주세요. 메일 속 링크는 1시간 안에 한 번만 쓸 수 있어요.'}
      </p>
      <a className="auth-btn" href="/login">
        비밀번호 찾기 다시 하기
      </a>
      <p className="auth-fine" style={{ marginTop: 12 }}>
        오류 코드: {fail}
      </p>
    </>
  )
}
