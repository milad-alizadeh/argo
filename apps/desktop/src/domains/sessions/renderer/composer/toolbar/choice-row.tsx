import type { ComponentProps } from 'react'
import { cn } from '@/platform/renderer/lib/utils'

export function ChoiceRow({
  selected,
  className,
  htmlFor,
  children,
  ...props
}: ComponentProps<'label'> & { selected: boolean; htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'flex min-h-12 w-full items-center rounded-md px-2.5 py-1.5 text-left transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
        selected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </label>
  )
}
