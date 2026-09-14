import type { ReactNode } from 'react'

type InlineContextProps = {
  icon: ReactNode
  text: string
}

// Text context follows markdown-link rhythm; dragged files use attachment cards instead.
export function InlineContext({ icon, text }: InlineContextProps) {
  return (
    <span className="mx-0.5 inline-flex max-w-full items-center gap-1 text-foreground underline decoration-border underline-offset-4">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  )
}
