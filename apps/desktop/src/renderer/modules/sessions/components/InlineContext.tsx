import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type InlineContextProps = {
  icon: ReactNode
  label?: string
  onClick?: () => void
  onRemove?: () => void
  removeLabel?: string
  text: string
}

// Text references are compact context, unlike a dragged attachment whose preview needs a card.
export function InlineContext({
  icon,
  label,
  onClick,
  onRemove,
  removeLabel,
  text,
}: InlineContextProps) {
  const content = (
    <>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="truncate">{text}</span>
    </>
  )
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted px-2 py-1 align-text-bottom type-meta">
      {onClick ? (
        <button
          aria-label={label}
          className="flex min-w-0 items-center gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClick}
          type="button"
        >
          {content}
        </button>
      ) : (
        content
      )}
      {onRemove && removeLabel ? (
        <button
          aria-label={removeLabel}
          className="shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onRemove}
          type="button"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </span>
  )
}
