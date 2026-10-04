import Link from 'next/link'

export function PageHead({ title, desc, children }: { title: string; desc?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="ad-head no-print">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {children && <div className="ad-head-acts">{children}</div>}
    </header>
  )
}

export function Badge({ tone = 'gray', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`ad-badge ${tone}`}>{children}</span>
}

export function Tabs({ items, current }: { items: { key: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <nav className="ad-tabs no-print">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={t.key === current ? 'on' : undefined}>
          {t.label}
          {t.count !== undefined && <span>{t.count}</span>}
        </Link>
      ))}
    </nav>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="ad-empty">
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  )
}
