import type { ReactNode } from 'react'
import { inlineContextSlots } from './inline-context-recipe'

type InlineContextProps = {
  icon: ReactNode
  text: string
}

// A reference is a mark, not a link, so it takes no underline; `align-middle` sits the whole chip
// on the line's centre rather than hanging its icon above the words beside it (#2273). Dragged
// files use attachment cards instead.
export function InlineContext({ icon, text }: InlineContextProps) {
  return (
    <span
      className={`${inlineContextSlots.root} mx-0.5 inline-flex max-w-full items-center gap-1 align-middle text-foreground`}
    >
      <span className={`${inlineContextSlots.icon} shrink-0 text-muted-foreground`}>{icon}</span>
      <span className={`${inlineContextSlots.label} truncate`}>{text}</span>
    </span>
  )
}
