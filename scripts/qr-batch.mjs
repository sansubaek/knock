#!/usr/bin/env node
// 인쇄소에 넘길 QR 파일 만들기
//
// 사용법 (관리자 페이지에서 받은 CSV를 그대로 넣으면 된다):
//   node scripts/qr-batch.mjs --csv knock-qr-2026-10-04.csv --style bang --mm 25 --site https://knock.im
//   node scripts/qr-batch.mjs --ids A7K2QX,B8M3RT --style dot
//
// 만들어지는 것 (qr-out/ 폴더):
//   ID.svg  화면 확인·웹용      ID.eps  인쇄소 제출용(와우프레스 등 AI/EPS만 받는 곳)
//   ID.pdf  PDF 받는 곳용       ID.png  검수용 이미지
//   check.csv  모든 파일을 다시 읽어서 주소가 맞게 찍히는지 확인한 결과
import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { Resvg } from '@resvg/resvg-js'
import jsQR from 'jsqr'
import { STYLES, contrast, shapes, toEPS, toSVG } from './qr-art.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : acc), []),
)
const site = String(args.site || process.env.NEXT_PUBLIC_SITE_URL || 'https://knock.im').replace(/\/$/, '')
const style = String(args.style || 'classic')
const mm = Number(args.mm || 25)
const outDir = String(args.out || 'qr-out')
if (!STYLES[style]) {
  console.error('스타일 이름이 없어요. 가능한 것:', Object.keys(STYLES).join(', '))
  process.exit(1)
}

let ids = []
if (args.csv) {
  const lines = fs.readFileSync(String(args.csv), 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1)
  ids = lines.map((l) => l.split(',')[0].replace(/"/g, '').trim()).filter(Boolean)
} else if (args.ids) ids = String(args.ids).split(',').map((s) => s.trim())
if (!ids.length) {
  console.error('--csv 또는 --ids 를 넣어주세요')
  process.exit(1)
}
const bad = ids.filter((id) => !/^[A-HJKMNP-Z2-9]{6,8}$/.test(id))
if (bad.length) {
  console.error('형식이 틀린 ID:', bad.join(', '))
  process.exit(1)
}

const st = STYLES[style]
const ratio = contrast(st.dark, st.light)
if (ratio < 4.5) console.warn(`⚠ 이 색 조합은 대비가 ${ratio.toFixed(1)}:1로 낮아요. 4.5:1 이상을 권장해요. 실물로 꼭 찍어보세요.`)
if (contrast(st.dark, '#000000') > contrast(st.light, '#000000')) console.warn('⚠ 밝은 점 + 어두운 바탕(반전)은 일부 구형 안드로이드 카메라가 못 읽어요.')

fs.mkdirSync(outDir, { recursive: true })

function pdfFor(url, file) {
  return new Promise((resolve) => {
    const { size, items, style: s } = shapes(url, style)
    const pt = (mm / 25.4) * 72
    const doc = new PDFDocument({ size: [pt, pt], margin: 0, info: { Title: `knock QR ${url}` } })
    const stream = fs.createWriteStream(file)
    doc.pipe(stream)
    doc.scale(pt / size)
    doc.rect(0, 0, size, size).fill(s.light)
    const svg = toSVG(url, style)
    const d = svg.match(/ d="([^"]+)"/)[1]
    doc.path(d).fill(s.dark, 'even-odd')
    doc.end()
    stream.on('finish', resolve)
    void items
  })
}

const report = ['QR_ID,주소,QR버전,읽힘,읽은값']
for (const id of ids) {
  const url = `${site}/c/${id}`
  const svg = toSVG(url, style, { px: 800 })
  fs.writeFileSync(path.join(outDir, `${id}.svg`), svg)
  fs.writeFileSync(path.join(outDir, `${id}.eps`), toEPS(url, style, { mm }))
  await pdfFor(url, path.join(outDir, `${id}.pdf`))
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: 400 } }).render()
  fs.writeFileSync(path.join(outDir, `${id}.png`), img.asPng())
  const res = jsQR(new Uint8ClampedArray(img.pixels), img.width, img.height, { inversionAttempts: 'attemptBoth' })
  const ok = res?.data === url
  report.push([id, url, shapes(url, style).version, ok ? 'O' : 'X', res?.data ?? ''].join(','))
  console.log(`${ok ? '✓' : '✗'} ${id}  ${url}`)
}
fs.writeFileSync(path.join(outDir, 'check.csv'), '﻿' + report.join('\n'))
console.log(`\n${ids.length}개 완료 → ${outDir}/  (실물 크기 ${mm}mm, 스타일 ${st.name}, 대비 ${ratio.toFixed(1)}:1)`)
