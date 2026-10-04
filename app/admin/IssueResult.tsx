'use client'

import type { IssuedItem } from './actions'

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function IssueResult({ items }: { items: IssuedItem[] }) {
  if (!items.length) return null
  const csv = () =>
    download(
      `knock-qr-${new Date().toISOString().slice(0, 10)}.csv`,
      '﻿' + ['QR_ID,라인,활성화코드,주소,메모', ...items.map((i) => [i.id, i.line, i.code, i.url, i.label ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n'),
      'text/csv;charset=utf-8',
    )
  return (
    <div className="ad-issue">
      <div className="ad-note warn no-print">
        <b>활성화 코드는 지금 이 화면에서만 보여요.</b> 새로고침하면 다시 볼 수 없으니 CSV부터 받아두세요.
      </div>
      <div className="ad-issue-acts no-print">
        <button type="button" className="ad-btn primary" onClick={csv}>
          ① CSV 받기 (코드 포함)
        </button>
        <button type="button" className="ad-btn" onClick={() => window.print()}>
          ② 웰컴 카드 인쇄
        </button>
        <span className="ad-hint">인쇄 설정: A4, 배율 100%. 업체에는 아래 SVG 파일을 보내요.</span>
      </div>

      <div className="ad-card flush no-print">
        <div className="ad-scroll">
          <table className="ad-table">
            <thead>
              <tr>
                <th>QR</th>
                <th>ID</th>
                <th>라인</th>
                <th>활성화 코드</th>
                <th>업체용 파일</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="ad-qr" dangerouslySetInnerHTML={{ __html: i.svg }} />
                  </td>
                  <td>
                    <b className="mono">{i.id}</b>
                    {i.label && <div className="ad-sub">{i.label}</div>}
                  </td>
                  <td>{i.line === 'dot' ? 'knock.' : 'knock!'}</td>
                  <td>
                    <span className="ad-code">{i.code}</span>
                  </td>
                  <td>
                    <button type="button" className="ad-btn sm" onClick={() => download(`${i.id}.svg`, i.svg, 'image/svg+xml')}>
                      SVG 받기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 인쇄할 때만 보이는 웰컴 카드 (90×55mm, A4 한 장에 10장) */}
      <div className="print-sheet">
        {items.map((i) => (
          <WelcomeCard key={i.id} item={i} />
        ))}
      </div>
    </div>
  )
}

export function WelcomeCard({ item }: { item: IssuedItem }) {
  const bang = item.line === 'bang'
  return (
    <div className={`wcard ${bang ? 'wcard-bang' : 'wcard-dot'}`}>
      <div className="wcard-head">
        <span className="wcard-brand">{bang ? 'knock!' : 'knock.'}</span>
        <span className="wcard-id">{item.id}</span>
      </div>
      <p className="wcard-title">{bang ? '똑똑, 케이스가 도착했어요!' : '케이스가 도착했습니다.'}</p>
      <ol className="wcard-steps">
        <li>케이스 뒤 QR을 카메라로 찍어요</li>
        <li>로그인하고</li>
        <li>아래 6자리 코드를 넣으면 문이 열려요</li>
      </ol>
      <div className="wcard-code">
        <span>{item.code.slice(0, 3)}</span>
        <span>{item.code.slice(3)}</span>
      </div>
      <p className="wcard-fine">한 번 쓰면 사라지는 코드예요. 남에게 보여주지 마세요.</p>
    </div>
  )
}
