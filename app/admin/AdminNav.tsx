'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Item = { href: string; label: string; count?: number }

export function AdminNav({ items }: { items: Item[] }) {
  const path = usePathname()
  return (
    <nav className="ad-nav">
      {items.map((it) => {
        const on = it.href === '/admin' ? path === '/admin' : path === it.href || path.startsWith(it.href + '/')
        return (
          <Link key={it.href} href={it.href} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined}>
            <span>{it.label}</span>
            {!!it.count && <em className="ad-count">{it.count > 99 ? '99+' : it.count}</em>}
          </Link>
        )
      })}
      <Link href="/my" className="ad-only-m">
        <span>내 knock</span>
      </Link>
    </nav>
  )
}

export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
