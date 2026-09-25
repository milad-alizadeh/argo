import { cn } from 'cn'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Icon, type IconName } from './icon/icon'

type HeadingLevel = 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export type SectionTitleProps = ComponentPropsWithoutRef<'h3'> & {
  as?: HeadingLevel
  children: ReactNode
  icon?: IconName
}

// One typography role for compact section labels. Callers choose document level and optional
// decorative icon; spacing, size, and alignment stay consistent everywhere it is used.
export function SectionTitle({
  as: Heading = 'h3',
  children,
  className,
  icon,
  ...props
}: SectionTitleProps) {
  return (
    <Heading
      className={cn('flex items-center gap-(--spacing-shell-tight) type-meta-heading', className)}
      {...props}
    >
      {icon ? <Icon name={icon} size="meta" /> : null}
      {children}
    </Heading>
  )
}
