// knock QR 그리기: 같은 QR을 SVG(화면·검수), PDF, EPS(인쇄소 제출용)로 만든다.
// 외부 QR 사이트를 쓰지 않고 우리 주소(도메인/c/ID)를 직접 QR로 만든다.
import QRCode from 'qrcode'

export const STYLES = {
  classic: { name: '기본 검정', dark: '#000000', light: '#FFFFFF', module: 'square', eye: 'square', pupil: 'square' },
  bang: { name: 'knock! 초코', dark: '#5A3A26', light: '#FAF6EC', module: 'rounded', eye: 'rounded', pupil: 'rounded' },
  bangDots: { name: 'knock! 도트', dark: '#5A3A26', light: '#FFFFFF', module: 'dots', eye: 'rounded', pupil: 'circle' },
  dot: { name: 'knock. 모노 도트', dark: '#111113', light: '#FFFFFF', module: 'dots', eye: 'rounded', pupil: 'circle' },
  dotSquare: { name: 'knock. 모노 각진', dark: '#111113', light: '#FFFFFF', module: 'square', eye: 'square', pupil: 'square' },
  pink: { name: '진분홍', dark: '#B0204F', light: '#FFFFFF', module: 'rounded', eye: 'rounded', pupil: 'circle' },
  blue: { name: '파랑', dark: '#2547F4', light: '#FFFFFF', module: 'rounded', eye: 'rounded', pupil: 'rounded' },
  inverted: { name: '반전 (밝은 점, 어두운 바탕)', dark: '#FAF6EC', light: '#5A3A26', module: 'rounded', eye: 'rounded', pupil: 'rounded' },
  palePink: { name: '연분홍 (피해야 할 예)', dark: '#E8738A', light: '#FAF6EC', module: 'dots', eye: 'rounded', pupil: 'circle' },
}

// WCAG 상대 휘도 대비. QR은 4.5 이상을 권장 기준으로 쓴다
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

export function matrix(text, ecl = 'H') {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecl })
  const n = qr.modules.size
  const dark = (r, c) => qr.modules.get(r, c) === 1 || qr.modules.get(r, c) === true
  return { n, dark, version: qr.version }
}

function inEye(r, c, n) {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
}

/** 도형 목록 만들기 (단위: 모듈 1칸 = 1). quiet: 여백 칸 수 */
export function shapes(text, styleKey = 'classic', quiet = 4) {
  const st = STYLES[styleKey]
  const { n, dark, version } = matrix(text)
  const size = n + quiet * 2
  const out = []
  for (let r = 0; r < n; r++) {
    // 각진 모양은 가로로 이어진 칸을 한 사각형으로 합쳐 인쇄 때 이음새가 안 생기게
    if (st.module === 'square') {
      let c = 0
      while (c < n) {
        if (dark(r, c) && !inEye(r, c, n)) {
          let e = c
          while (e + 1 < n && dark(r, e + 1) && !inEye(r, e + 1, n)) e++
          out.push({ t: 'rect', x: c + quiet, y: r + quiet, w: e - c + 1, h: 1, rad: 0 })
          c = e + 1
        } else c++
      }
      continue
    }
    for (let c = 0; c < n; c++) {
      if (!dark(r, c) || inEye(r, c, n)) continue
      const x = c + quiet
      const y = r + quiet
      if (st.module === 'dots') out.push({ t: 'circle', cx: x + 0.5, cy: y + 0.5, r: 0.46 })
      else out.push({ t: 'rect', x: x + 0.04, y: y + 0.04, w: 0.92, h: 0.92, rad: 0.32 })
    }
  }
  const eyes = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ]
  for (const [er, ec] of eyes) {
    const x = ec + quiet
    const y = er + quiet
    const oRad = st.eye === 'rounded' ? 2 : 0
    out.push({ t: 'ring', x, y, w: 7, h: 7, rad: oRad, ix: x + 1, iy: y + 1, iw: 5, ih: 5, irad: st.eye === 'rounded' ? 1.3 : 0 })
    if (st.pupil === 'circle') out.push({ t: 'circle', cx: x + 3.5, cy: y + 3.5, r: 1.5 })
    else out.push({ t: 'rect', x: x + 2, y: y + 2, w: 3, h: 3, rad: st.pupil === 'rounded' ? 0.8 : 0 })
  }
  return { size, items: out, style: st, version }
}

const f = (v) => +v.toFixed(4)

function rrPath(x, y, w, h, r) {
  if (!r) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`
  return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${f(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${f(-(w - 2 * r))}a${r} ${r} 0 0 1 ${-r} ${-r}v${f(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}Z`
}

/** SVG. px: 출력 크기 (viewBox는 모듈 단위라 얼마든지 키워도 선명) */
export function toSVG(text, styleKey = 'classic', { px = 600, quiet = 4 } = {}) {
  const { size, items, style } = shapes(text, styleKey, quiet)
  let d = ''
  for (const it of items) {
    if (it.t === 'rect') d += rrPath(it.x, it.y, it.w, it.h, it.rad)
    else if (it.t === 'circle') d += `M${f(it.cx - it.r)} ${f(it.cy)}a${it.r} ${it.r} 0 1 0 ${f(2 * it.r)} 0a${it.r} ${it.r} 0 1 0 ${f(-2 * it.r)} 0Z`
    else if (it.t === 'ring') d += rrPath(it.x, it.y, it.w, it.h, it.rad) + rrPath(it.ix, it.iy, it.iw, it.ih, it.irad)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size} ${size}" shape-rendering="geometricPrecision"><rect width="${size}" height="${size}" fill="${style.light}"/><path fill="${style.dark}" fill-rule="evenodd" d="${d}"/></svg>`
}

function rgb(hex) {
  return [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4)).join(' ')
}

// PostScript 둥근 사각형 (y축이 위로 가므로 뒤집어서 그린다)
function psRR(x, y, w, h, r, S) {
  const X = x
  const Y = S - y - h
  if (!r) return `${f(X)} ${f(Y)} moveto ${f(w)} 0 rlineto 0 ${f(h)} rlineto ${f(-w)} 0 rlineto closepath\n`
  return `${f(X + r)} ${f(Y)} moveto ${f(X + w)} ${f(Y)} ${f(X + w)} ${f(Y + h)} ${r} arcto 4 {pop} repeat ${f(X + w)} ${f(Y + h)} ${f(X)} ${f(Y + h)} ${r} arcto 4 {pop} repeat ${f(X)} ${f(Y + h)} ${f(X)} ${f(Y)} ${r} arcto 4 {pop} repeat ${f(X)} ${f(Y)} ${f(X + w)} ${f(Y)} ${r} arcto 4 {pop} repeat closepath\n`
}

/** EPS (인쇄소 제출용 벡터). mm: 실제 인쇄 크기 */
export function toEPS(text, styleKey = 'classic', { mm = 25, quiet = 4 } = {}) {
  const { size, items, style } = shapes(text, styleKey, quiet)
  const pt = (mm / 25.4) * 72
  const k = pt / size
  let body = ''
  for (const it of items) {
    if (it.t === 'rect') body += psRR(it.x, it.y, it.w, it.h, it.rad, size)
    else if (it.t === 'circle') body += `${f(it.cx + it.r)} ${f(size - it.cy)} moveto ${f(it.cx)} ${f(size - it.cy)} ${it.r} 0 360 arc closepath\n`
    else if (it.t === 'ring') body += psRR(it.x, it.y, it.w, it.h, it.rad, size) + psRR(it.ix, it.iy, it.iw, it.ih, it.irad, size)
  }
  const box = Math.ceil(pt)
  return `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${box} ${box}
%%HiResBoundingBox: 0 0 ${f(pt)} ${f(pt)}
%%Title: knock QR ${text}
%%Creator: knock qr-art
%%EndComments
gsave
${k} ${k} scale
${rgb(style.light)} setrgbcolor 0 0 moveto ${size} 0 rlineto 0 ${size} rlineto ${-size} 0 rlineto closepath fill
${rgb(style.dark)} setrgbcolor
newpath
${body}eofill
grestore
showpage
%%EOF
`
}
