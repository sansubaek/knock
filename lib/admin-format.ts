// 관리자 화면용 표시 도우미. 시간은 전부 한국 시간으로 보여준다.

const parts = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function pick(d: Date) {
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]))
  return p as Record<string, string>
}

/** 10.05 02:13 */
export function kst(iso: string | null | undefined) {
  if (!iso) return '-'
  const p = pick(new Date(iso))
  return `${p.month}.${p.day} ${p.hour}:${p.minute}`
}

/** 2026.10.05 */
export function kstDate(iso: string | null | undefined) {
  if (!iso) return '-'
  const p = pick(new Date(iso))
  return `${p.year}.${p.month}.${p.day}`
}

/** 방금 / 5분 전 / 3시간 전 / 2일 전 / 10.05 */
export function ago(iso: string | null | undefined) {
  if (!iso) return '-'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`
  return kst(iso).slice(0, 5)
}

export const lineName = (line: string | null | undefined) => (line === 'dot' ? 'knock.' : 'knock!')

export const ORDER_STATUS: Record<string, string> = {
  received: '접수',
  requested: '제작 요청',
  producing: '제작 중',
  shipped: '발송',
  activated: '활성화 완료',
  canceled: '취소',
}

export const ORDER_TONE: Record<string, string> = {
  received: 'red',
  requested: 'orange',
  producing: 'blue',
  shipped: 'purple',
  activated: 'green',
  canceled: 'gray',
}

export const QR_STATUS: Record<string, string> = { issued: '발급됨', printed: '인쇄 넘김', active: '사용 중', retired: '폐기' }
export const QR_TONE: Record<string, string> = { issued: 'gray', printed: 'blue', active: 'green', retired: 'gray' }

/** 관리자 작업 기록을 사람이 읽는 문장으로 */
export function describeLog(action: string, target: string | null): string {
  const t = target ?? ''
  switch (action) {
    case 'qr.issue_batch': {
      const m = t.match(/^(bang|dot) x(\d+)/)
      return m ? `QR ${m[2]}개 발급 · ${lineName(m[1])}` : 'QR 발급'
    }
    case 'qr.mark_printed':
      return `QR ${t.split(',').filter(Boolean).length}개를 '인쇄 넘김'으로 표시`
    case 'qr.reissue_code':
      return `${t} 활성화 코드 재발급`
    case 'qr.status.retired':
      return `${t} 폐기`
    case 'qr.status.printed':
      return `${t} 인쇄 넘김으로 변경`
    case 'qr.status.issued':
      return `${t} 발급 상태로 되돌림`
    case 'order.issue_qr': {
      const qr = t.split('→')[1]?.trim()
      return qr ? `주문에 QR 발급 · ${qr}` : '주문에 QR 발급'
    }
    case 'order.update': {
      const s = t.split(' ')[1]
      return s && ORDER_STATUS[s] ? `주문 상태 변경 → ${ORDER_STATUS[s]}` : '주문 정보 저장'
    }
    case 'inquiry.reply':
      return '문의 답변 저장'
    case 'guestbook.hide':
      return '방명록 글 숨김'
    default:
      return action
  }
}
