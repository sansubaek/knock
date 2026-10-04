import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return {
      // 첫 화면은 지금까지 만든 정적 홈페이지를 그대로 쓴다
      beforeFiles: [{ source: '/', destination: '/home.html' }],
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
