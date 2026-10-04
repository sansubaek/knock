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
    <div className="issue">
      <div className="issue-acts no-print">
        <button type="button" className="btn-s solid" onClick={csv}>
          CSV 받기 (코드 포함)
        </button>
        <button type="button" className="btn-s" onClick={() => window.print()}>
          웰컴 카드 인쇄
        </button>
        <span className="mute small">인쇄 설정: A4, 배율 100%, 여백 없음 또는 기본</span>
      </div>

      <table className="adm-table no-print">
        <thead>
          <tr>
            <th>QR</th>
            <th>ID</th>
            <th>라인</th>
            <th>활성화 코드</th>
            <th>인쇄소용 파일</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                <span className="qr-thumb" dangerouslySetInnerHTML={{ __html: i.svg }} />
              </td>
              <td className="mono">
                {i.id}
                {i.label && <div className="small mute">{i.label}</div>}
              </td>
              <td>{i.line === 'dot' ? 'knock.' : 'knock!'}</td>
              <td className="mono big">{i.code}</td>
              <td>
                <button type="button" className="link-btn" onClick={() => download(`${i.id}.svg`, i.svg, 'image/svg+xml')}>
                  SVG
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
