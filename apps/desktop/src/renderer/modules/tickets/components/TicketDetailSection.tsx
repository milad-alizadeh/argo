import type { ReactNode } from 'react'

export function TicketDetailSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="grid grid-cols-[minmax(0,1fr)] gap-(--spacing-shell-tight)"
    >
      <h3 className="flex items-center gap-(--spacing-shell-tight) type-label text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}
