// An anchored surface, so a hairline and no shadow (ADR-0038). The refusal says what happened and
// carries the action that answers it, when there is one.
import { CircleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Item, ItemContent, ItemMedia, ItemTitle } from '../../../components/ui/item'

const MESSAGE = 'text-body font-medium text-destructive'

export function ProjectRefusal({ message, children }: { message: string; children?: ReactNode }) {
  // With no action to place, the refusal is a sentence rather than a row: a box drawn around one
  // line of text is an edge that separates it from nothing.
  if (!children) {
    return (
      <p
        data-component="ProjectRefusal"
        className="flex items-center justify-center gap-2 text-center"
      >
        <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
        <span data-slot="item-title" className={MESSAGE}>
          {message}
        </span>
      </p>
    )
  }
  return (
    <Item
      data-component="ProjectRefusal"
      variant="outline"
      className="gap-3 rounded-lg border-destructive/30 bg-card px-4 py-3"
    >
      <ItemMedia variant="icon">
        <CircleAlertIcon className="text-destructive" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className={MESSAGE}>{message}</ItemTitle>
      </ItemContent>
      {children}
    </Item>
  )
}
