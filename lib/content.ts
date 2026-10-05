// 페이지 내용(블록)과 디자인(템플릿·테마) 정의.
// 새 템플릿이나 블록 종류를 추가할 때는 이 파일만 고치면 된다. DB는 바꿀 필요 없다.

export type Line = 'bang' | 'dot'

export type BlockType = 'profile' | 'mood' | 'text' | 'link' | 'photo' | 'music' | 'card' | 'career'

export type Block = { id: string; type: BlockType | string; data: Record<string, unknown>; is_visible?: boolean }

type FieldDef = { key: string; label: string; kind: 'text' | 'textarea' | 'url' | 'email' | 'tel' | 'image' | 'emoji'; max: number; placeholder?: string }

export const BLOCK_DEFS: Record<BlockType, { label: string; lines: Line[]; fields: FieldDef[]; hint?: string }> = {
  profile: {
    label: '프로필',
    lines: ['bang'],
    fields: [
      { key: 'avatar', label: '프로필 사진', kind: 'image', max: 500 },
      { key: 'name', label: '이름', kind: 'text', max: 20, placeholder: '지우' },
      { key: 'bio', label: '한 줄 소개', kind: 'textarea', max: 80, placeholder: '노크하고 들어와' },
    ],
  },
  card: {
    label: '명함',
    lines: ['dot'],
    hint: '연락처 저장 버튼에 이 정보가 들어가요',
    fields: [
      { key: 'avatar', label: '사진 (선택)', kind: 'image', max: 500 },
      { key: 'name', label: '이름', kind: 'text', max: 20, placeholder: '주건우' },
      { key: 'title', label: '직함', kind: 'text', max: 30, placeholder: 'Product Designer' },
      { key: 'org', label: '소속', kind: 'text', max: 40, placeholder: 'knock' },
      { key: 'phone', label: '전화번호', kind: 'tel', max: 20, placeholder: '010-0000-0000' },
      { key: 'email', label: '이메일', kind: 'email', max: 80, placeholder: 'me@knock.im' },
      { key: 'website', label: '웹사이트', kind: 'url', max: 200, placeholder: 'https://' },
    ],
  },
  mood: {
    label: '오늘의 기분',
    lines: ['bang'],
    fields: [
      { key: 'emoji', label: '이모지', kind: 'emoji', max: 8, placeholder: '☁️' },
      { key: 'text', label: '한 줄', kind: 'text', max: 40, placeholder: '시험 끝나면 연락할게' },
    ],
  },
  text: {
    label: '글',
    lines: ['bang', 'dot'],
    fields: [{ key: 'text', label: '내용', kind: 'textarea', max: 400 }],
  },
  link: {
    label: '링크',
    lines: ['bang', 'dot'],
    fields: [
      { key: 'label', label: '버튼 이름', kind: 'text', max: 30, placeholder: '인스타그램' },
      { key: 'url', label: '주소', kind: 'url', max: 300, placeholder: 'https://instagram.com/...' },
    ],
  },
  photo: {
    label: '사진',
    lines: ['bang', 'dot'],
    fields: [
      { key: 'url', label: '사진', kind: 'image', max: 500 },
      { key: 'caption', label: '설명', kind: 'text', max: 60 },
    ],
  },
  music: {
    label: '요즘 듣는 노래',
    lines: ['bang'],
    fields: [
      { key: 'title', label: '제목', kind: 'text', max: 40 },
      { key: 'artist', label: '가수', kind: 'text', max: 40 },
      { key: 'url', label: '듣기 링크 (선택)', kind: 'url', max: 300 },
    ],
  },
  career: {
    label: '경력',
    lines: ['dot'],
    hint: '한 줄에 하나씩. 예: 2024 — knock 공동창업',
    fields: [{ key: 'lines', label: '경력', kind: 'textarea', max: 600 }],
  },
}

export function isBlockType(t: string): t is BlockType {
  return t in BLOCK_DEFS
}

/** 링크로 쓸 수 있는 주소만 통과 (javascript: 같은 것 차단) */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let v = raw.trim()
  if (!v) return null
  if (/^(mailto:|tel:)/i.test(v)) return v
  if (!/^https?:\/\//i.test(v)) {
    if (/^[\w-]+(\.[\w-]+)+/.test(v)) v = `https://${v}`
    else return null
  }
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** 이미지는 우리 Supabase 저장소에 올린 것만 (외부 이미지로 방문자 IP를 모으지 못하게) */
export function safeImage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const u = new URL(raw)
    const own = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://invalid.local')
    if (u.origin !== own.origin) return null
    if (!u.pathname.startsWith('/storage/v1/object/public/page-media/')) return null
    return u.toString()
  } catch {
    return null
  }
}

export function str(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/** 저장 전에 블록 데이터 정리: 정의된 칸만, 길이 제한 */
export function cleanBlockData(type: string, data: Record<string, unknown>) {
  if (!isBlockType(type)) return {}
  const out: Record<string, string> = {}
  for (const f of BLOCK_DEFS[type].fields) {
    const v = str(data[f.key], f.max).trim()
    if (v) out[f.key] = v
  }
  return out
}

export function defaultBlocks(line: Line, nickname?: string | null): { type: BlockType; data: Record<string, string> }[] {
  if (line === 'dot') {
    return [
      { type: 'card', data: { name: nickname ?? '' } },
      { type: 'text', data: { text: '만나서 반가워요.' } },
    ]
  }
  return [
    { type: 'profile', data: { name: nickname ?? '', bio: '똑똑, 들어와도 돼' } },
    { type: 'mood', data: { emoji: '☁️', text: '오늘의 기분을 적어봐' } },
  ]
}

// ── 템플릿 ──────────────────────────────────────

export type Template = {
  key: string
  name: string
  line: Line
  desc: string
  font: string // CSS font-family
  fontHref?: string // Google Fonts
  vars: Record<string, string>
  className: string
}

const GF = 'https://fonts.googleapis.com/css2?display=swap&family='

export const TEMPLATES: Template[] = [
  {
    key: 'clean',
    name: '클린',
    line: 'bang',
    desc: '회색 바탕에 흰 카드, 핑크 포인트',
    font: '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif',
    fontHref: `${GF}Noto+Sans+KR:wght@400;500;700;800`,
    vars: { '--bg': '#F2F4F6', '--card': '#FFFFFF', '--ink': '#191F28', '--mute': '#6B7684', '--accent': '#E0335E', '--edge': '#F2F4F6' },
    className: 't-clean',
  },
  {
    key: 'clean',
    name: '클린',
    line: 'dot',
    desc: '회색 바탕에 흰 카드, 파란 포인트',
    font: '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif',
    fontHref: `${GF}Noto+Sans+KR:wght@400;500;700;800`,
    vars: { '--bg': '#F2F4F6', '--card': '#FFFFFF', '--ink': '#191F28', '--mute': '#6B7684', '--accent': '#1F5EFF', '--edge': '#F2F4F6' },
    className: 't-clean',
  },
  {
    key: 'basic',
    name: '기본',
    line: 'bang',
    desc: '아이보리 바탕에 말랑한 글씨',
    font: '"Jua", "IBM Plex Sans KR", sans-serif',
    fontHref: `${GF}Jua`,
    vars: { '--bg': '#FAF6EC', '--card': '#FFFFFF', '--ink': '#5A3A26', '--mute': '#8A6B55', '--accent': '#E8738A', '--edge': '#5A3A26' },
    className: 't-basic',
  },
  {
    key: 'minihompy',
    name: '미니홈피',
    line: 'bang',
    desc: '그 시절 파란 테두리, 투데이 카운터',
    font: '"Nanum Gothic", "Apple SD Gothic Neo", sans-serif',
    fontHref: `${GF}Nanum+Gothic:wght@400;700;800`,
    vars: { '--bg': '#CFE3F2', '--card': '#FFFFFF', '--ink': '#333333', '--mute': '#7A7A7A', '--accent': '#FF7A00', '--edge': '#7FA9C9' },
    className: 't-minihompy',
  },
  {
    key: 'diary',
    name: '다이어리',
    line: 'bang',
    desc: '줄 노트에 손글씨, 마스킹테이프',
    font: '"Gaegu", "Jua", sans-serif',
    fontHref: `${GF}Gaegu:wght@400;700`,
    vars: { '--bg': '#FFFDF6', '--card': '#FFFFFF', '--ink': '#3B3530', '--mute': '#8C847B', '--accent': '#F29BB3', '--edge': '#E7DFD2' },
    className: 't-diary',
  },
  {
    key: 'y2k',
    name: 'Y2K',
    line: 'bang',
    desc: '보라·분홍 그라데이션, 반짝이',
    font: '"Jua", "IBM Plex Sans KR", sans-serif',
    fontHref: `${GF}Jua`,
    vars: { '--bg': '#EDE7FF', '--card': 'rgba(255,255,255,.72)', '--ink': '#2C1F5E', '--mute': '#6E62A0', '--accent': '#7B5CFF', '--edge': '#FFFFFF' },
    className: 't-y2k',
  },
  {
    key: 'night',
    name: '밤하늘',
    line: 'bang',
    desc: '남색 하늘에 별, 노란 포인트',
    font: '"Jua", "IBM Plex Sans KR", sans-serif',
    fontHref: `${GF}Jua`,
    vars: { '--bg': '#141831', '--card': '#1E2346', '--ink': '#F1F0FF', '--mute': '#A6A9CC', '--accent': '#FFD66B', '--edge': '#2E3466' },
    className: 't-night',
  },
  {
    key: 'mono',
    name: '모노',
    line: 'dot',
    desc: '흰 바탕, 검은 글씨, 군더더기 없이',
    font: '"IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif',
    fontHref: `${GF}IBM+Plex+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@700&family=IBM+Plex+Mono:wght@500`,
    vars: { '--bg': '#FFFFFF', '--card': '#FFFFFF', '--ink': '#111113', '--mute': '#6B6E78', '--accent': '#111113', '--edge': '#E3E3E0' },
    className: 't-mono',
  },
  {
    key: 'ivory',
    name: '아이보리',
    line: 'dot',
    desc: '따뜻한 종이색, 세리프 이름',
    font: '"IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif',
    fontHref: `${GF}IBM+Plex+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@700&family=IBM+Plex+Mono:wght@500`,
    vars: { '--bg': '#F6F2E9', '--card': '#FFFDF8', '--ink': '#1D1B16', '--mute': '#77705F', '--accent': '#8A5A2B', '--edge': '#E2DACB' },
    className: 't-ivory',
  },
  {
    key: 'black',
    name: '블랙',
    line: 'dot',
    desc: '검은 바탕, 흰 글씨',
    font: '"IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif',
    fontHref: `${GF}IBM+Plex+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@700&family=IBM+Plex+Mono:wght@500`,
    vars: { '--bg': '#0E0E10', '--card': '#17171A', '--ink': '#F4F4F5', '--mute': '#9C9CA6', '--accent': '#F4F4F5', '--edge': '#2A2A30' },
    className: 't-black',
  },
]

export function templatesFor(line: Line) {
  return TEMPLATES.filter((t) => t.line === line)
}

export function getTemplate(line: Line, key: string | null | undefined): Template {
  return TEMPLATES.find((t) => t.line === line && t.key === key) ?? templatesFor(line)[0]
}

export const ACCENTS: Record<Line, string[]> = {
  bang: ['#E0335E', '#E8738A', '#FF7A00', '#7B5CFF', '#2547F4', '#1F9D6B', '#FFD66B', '#5A3A26'],
  dot: ['#1F5EFF', '#111113', '#8A5A2B', '#2547F4', '#1F5C4A', '#B4372F', '#F4F4F5'],
}

export type Theme = { accent?: string }

export function cleanTheme(raw: unknown): Theme {
  const t: Theme = {}
  if (raw && typeof raw === 'object') {
    const a = (raw as Record<string, unknown>).accent
    if (typeof a === 'string' && /^#[0-9a-fA-F]{6}$/.test(a)) t.accent = a
  }
  return t
}

// ── 스티커(데코) ─────────────────────────────────

export const STICKERS = ['star', 'heart', 'cloud', 'flower', 'sparkle', 'bubble', 'paw', 'ribbon', 'cherry', 'smile'] as const
export type StickerKey = (typeof STICKERS)[number]
export const STICKER_NAMES: Record<StickerKey, string> = {
  star: '별',
  heart: '하트',
  cloud: '구름',
  flower: '꽃',
  sparkle: '반짝',
  bubble: '말풍선',
  paw: '발자국',
  ribbon: '리본',
  cherry: '체리',
  smile: '스마일',
}

export type Decor = { item: string; x: number; y: number; rotation: number; scale: number; z: number }

export const VISIBILITY_LABELS: Record<string, { label: string; desc: string }> = {
  public: { label: '전체 공개', desc: 'QR을 찍은 누구나 볼 수 있어요' },
  link: { label: '링크 공개', desc: '지금은 전체 공개와 같아요. 나중에 검색·추천에서 빠지는 옵션이에요' },
  locked: { label: '암호 잠금', desc: '숫자 암호를 아는 사람만 볼 수 있어요' },
  private: { label: '비공개', desc: '나만 볼 수 있어요. 찍은 사람에게는 비공개라고 떠요' },
}
