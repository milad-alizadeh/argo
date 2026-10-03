import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

const fileHeaderRecipes = {
  default:
    'type-meta flex items-center justify-between border-b bg-muted/80 px-3 py-2 text-muted-foreground',
  inspector: 'flex min-w-0 items-center gap-2 bg-transparent px-4 py-3 text-foreground',
} as const

const fileHeaderTitleRecipes = {
  default: 'type-code',
  inspector: 'type-meta-heading',
} as const

export function FileHeaderPath({ path }: { path: string }) {
  return (
    <span className="block truncate text-left [direction:rtl]" title={path}>
      <bdi dir="ltr">{path}</bdi>
    </span>
  )
}

export function FileHeader({
  className,
  detail,
  leadingIcon,
  rightSlot,
  rightSlotClassName,
  heading,
  titleClassName,
  variant = 'default',
}: {
  className?: string
  detail?: ReactNode
  leadingIcon?: ReactNode
  rightSlot?: ReactNode
  rightSlotClassName?: string
  heading: ReactNode
  titleClassName?: string
  variant?: 'default' | 'inspector'
}) {
  const title = (
    <span
      className={cn(
        'min-w-0 truncate select-none',
        fileHeaderTitleRecipes[variant],
        titleClassName,
      )}
    >
      {heading}
    </span>
  )
  return (
    <div className={cn(fileHeaderRecipes[variant], className)}>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {leadingIcon === undefined ? null : (
          <span className="grid size-5 shrink-0 place-items-center">{leadingIcon}</span>
        )}
        {detail === undefined ? (
          title
        ) : (
          <span className="flex min-w-0 flex-1 flex-col">
            {title}
            <span className="truncate type-meta text-muted-foreground">{detail}</span>
          </span>
        )}
      </span>
      {rightSlot === undefined ? null : (
        <span
          className={cn(
            'flex shrink-0 items-center gap-2',
            variant === 'default' && '-my-1 -mr-1',
            rightSlotClassName,
          )}
        >
          {rightSlot}
        </span>
      )}
    </div>
  )
}
