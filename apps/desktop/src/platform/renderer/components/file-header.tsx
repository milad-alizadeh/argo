import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export function FileHeader({
  className,
  leadingIcon,
  rightSlot,
  rightSlotClassName,
  heading,
  titleClassName,
}: {
  className?: string
  leadingIcon?: ReactNode
  rightSlot?: ReactNode
  rightSlotClassName?: string
  heading: ReactNode
  titleClassName?: string
}) {
  return (
    <div
      className={cn(
        'type-meta flex items-center justify-between border-b bg-muted/80 px-3 py-2 text-muted-foreground',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {leadingIcon === undefined ? null : (
          <span className="grid size-5 shrink-0 place-items-center">{leadingIcon}</span>
        )}
        <span className={cn('min-w-0 truncate type-code select-none', titleClassName)}>
          {heading}
        </span>
      </span>
      {rightSlot === undefined ? null : (
        <span className={cn('-my-1 -mr-1 flex shrink-0 items-center gap-2', rightSlotClassName)}>
          {rightSlot}
        </span>
      )}
    </div>
  )
}
