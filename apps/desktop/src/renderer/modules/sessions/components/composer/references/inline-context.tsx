import type { ReactNode } from 'react'

type InlineContextProps = {
  icon: ReactNode
  text: string
}

// A reference is a mark, not a link, so it takes no underline; `align-middle` sits the whole chip
// on the line's centre rather than hanging its icon above the words beside it (#2273). Dragged
// files use attachment cards instead.
export function InlineContext({ icon, text }: InlineContextProps) {
  return (
    <span className="mx-0.5 inline-flex max-w-full items-center gap-1 align-middle text-foreground">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  )
}
