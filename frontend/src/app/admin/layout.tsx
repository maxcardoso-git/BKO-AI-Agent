import Link from 'next/link'
import { ReactNode } from 'react'

const adminNav = [
  { href: '/admin/personas', label: 'Personas' },
  { href: '/admin/templates', label: 'Templates' },
  { href: '/admin/steps', label: 'Fluxos (Steps)' },
  { href: '/admin/skills', label: 'Skills' },
  { href: '/admin/capabilities', label: 'Capabilities' },
  { href: '/admin/models', label: 'Modelos LLM' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-screen-xl px-4 py-3 flex items-center gap-6">
          <span className="font-semibold text-sm text-muted-foreground">Admin</span>
          <nav className="flex items-center gap-4">
            {adminNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm hover:text-foreground text-muted-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div>{children}</div>
    </div>
  )
}
