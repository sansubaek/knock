import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const PP_HOSTS = ['peapod.kr', 'www.peapod.kr', 'knock-snowy.vercel.app']
const PP_HOME = 'https://knock-demo-lac.vercel.app'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return {
      // 첫 화면은 지금까지 만든 정적 홈페이지를 그대로 쓴다
      beforeFiles: [
        // PeaPod 주소에서는 재승이 만드는 홈페이지를 그대로 보여 준다 (재승 쪽에 올리면 바로 반영)
        ...PP_HOSTS.flatMap((value) => {
          const has = [{ type: 'host' as const, value }]
          return [
            { source: '/', has, destination: `${PP_HOME}/` },
            { source: '/index.html', has, destination: `${PP_HOME}/` },
            { source: '/cases', has, destination: `${PP_HOME}/cases` },
            { source: '/cases.html', has, destination: `${PP_HOME}/cases` },
            // 가입 없이 둘러보는 방 (재승 데모 방)
            { source: '/room.html', has, destination: `${PP_HOME}/room` },
            { source: '/room-test', has, destination: `${PP_HOME}/room` },
          ]
        }),
        // PeaPod 방 앱: QR(/c/코드)로 들어오는 정식 방. 케이스·계정·방 저장은 /api/pp 가 맡는다
        { source: '/room', destination: '/pp/room.html' },
        { source: '/', destination: '/home.html' },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: { unoptimized: true },
}

export default nextConfig
