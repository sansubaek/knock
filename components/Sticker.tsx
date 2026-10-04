// 데코 스티커. 전부 직접 그린 SVG라 저작권 걱정이 없다.
export function Sticker({ name, size = 56 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true as const }
  const stroke = { stroke: '#3B2A20', strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  switch (name) {
    case 'star':
      return (
        <svg {...common}>
          <path d="M32 6l7.6 16 17.4 2.2-12.8 12 3.3 17.3L32 45l-15.5 8.5 3.3-17.3L7 24.2 24.4 22z" fill="#FFD66B" {...stroke} />
        </svg>
      )
    case 'heart':
      return (
        <svg {...common}>
          <path d="M32 54S8 40 8 23a12 12 0 0124-4 12 12 0 0124 4c0 17-24 31-24 31z" fill="#F28AA0" {...stroke} />
          <path d="M18 20a6 6 0 016-5" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        </svg>
      )
    case 'cloud':
      return (
        <svg {...common}>
          <path d="M18 46h30a10 10 0 000-20 14 14 0 00-27-3 11 11 0 00-3 23z" fill="#FFFFFF" {...stroke} />
          <circle cx="26" cy="35" r="2" fill="#3B2A20" />
          <circle cx="38" cy="35" r="2" fill="#3B2A20" />
        </svg>
      )
    case 'flower':
      return (
        <svg {...common}>
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse key={r} cx="32" cy="17" rx="9" ry="12" fill="#FFB8C9" {...stroke} transform={`rotate(${r} 32 32)`} />
          ))}
          <circle cx="32" cy="32" r="8" fill="#FFD66B" {...stroke} />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M32 6c2 14 6 20 22 26-16 6-20 12-22 26-2-14-6-20-22-26 16-6 20-12 22-26z" fill="#B9A6FF" {...stroke} />
        </svg>
      )
    case 'bubble':
      return (
        <svg {...common}>
          <path d="M10 14h44v28H30l-12 10v-10h-8z" fill="#FFFFFF" {...stroke} />
          <text x="32" y="33" textAnchor="middle" fontSize="12" fontWeight="800" fill="#3B2A20" fontFamily="system-ui">knock!</text>
        </svg>
      )
    case 'paw':
      return (
        <svg {...common}>
          <ellipse cx="32" cy="40" rx="12" ry="10" fill="#C89B7B" {...stroke} />
          <circle cx="17" cy="26" r="5" fill="#C89B7B" {...stroke} />
          <circle cx="27" cy="18" r="5" fill="#C89B7B" {...stroke} />
          <circle cx="38" cy="18" r="5" fill="#C89B7B" {...stroke} />
          <circle cx="47" cy="26" r="5" fill="#C89B7B" {...stroke} />
        </svg>
      )
    case 'ribbon':
      return (
        <svg {...common}>
          <path d="M32 30L10 18v26zM32 30l22-12v26z" fill="#F28AA0" {...stroke} />
          <path d="M28 34l-8 20 8-4 4 6 2-22" fill="#F28AA0" {...stroke} />
          <circle cx="32" cy="31" r="6" fill="#FFB8C9" {...stroke} />
        </svg>
      )
    case 'cherry':
      return (
        <svg {...common}>
          <path d="M22 40c4-14 10-24 22-30M42 40c-2-12 0-22 2-30" fill="none" {...stroke} />
          <circle cx="21" cy="45" r="9" fill="#E5484D" {...stroke} />
          <circle cx="43" cy="45" r="9" fill="#E5484D" {...stroke} />
        </svg>
      )
    case 'smile':
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="24" fill="#FFD66B" {...stroke} />
          <circle cx="24" cy="27" r="3" fill="#3B2A20" />
          <circle cx="40" cy="27" r="3" fill="#3B2A20" />
          <path d="M22 37c5 7 15 7 20 0" fill="none" {...stroke} />
        </svg>
      )
    default:
      return null
  }
}
