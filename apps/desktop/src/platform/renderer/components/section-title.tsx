import { cn } from 'cn'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Icon, type IconName } from './icon/icon'

type HeadingLevel = 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export type SectionTitleProps = ComponentPropsWithoutRef<'h3'> & {
  as?: HeadingLevel
  children: ReactNode
  icon?: IconName
  iconClassName?: string
  metadata?: ReactNode
}

// One typography role for compact section labels. Callers choose document level and optional
// decorative icon; spacing, size, and alignment stay consistent everywhere it is used.
export function SectionTitle({
  as: Heading = 'h3',
  children,
  className,
  icon,
  iconClassName,
  metadata,
  ...props
}: SectionTitleProps) {
  const title = (
    <Heading
      className={cn(
        'flex min-w-0 items-start gap-(--spacing-shell-tight) type-meta-heading',
        metadata !== undefined && 'flex-1',
        className,
      )}
      {...props}
    >
      {icon ? <Icon name={icon} size="meta" className={iconClassName} /> : null}
      <span className="min-w-0">{children}</span>
    </Heading>
  )
  if (metadata === undefined) return title
  return (
    <div className="flex min-w-0 items-baseline gap-(--spacing-shell-item)">
      {title}
      <span className="shrink-0 type-meta text-muted-foreground">{metadata}</span>
    </div>
  )
}
