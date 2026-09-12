import type { ReactNode } from 'react'

export function TicketsPage({ children }: { children?: ReactNode }) {
  return <main className="h-full min-h-0 bg-background">{children}</main>
}
