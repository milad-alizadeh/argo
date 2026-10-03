import type { ComponentProps } from 'react'
import { cn } from '@/platform/renderer/lib/utils'

export function ChoiceRow({
  selected,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { selected: boolean }) {
  return (
    <div
      className={cn(
        'relative flex min-h-12 w-full items-center rounded-md px-2.5 py-1.5 text-left transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
        selected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
