import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { statusToneRecipe } from './tone-recipes'

type StatusBadgeProps = Omit<
  ComponentPropsWithRef<typeof Badge>,
  'onClick' | 'onKeyDown' | 'onKeyUp' | 'tabIndex' | 'role' | 'variant' | 'render'
> & { tone: keyof typeof statusToneRecipe }

export function StatusBadge({ className, tone, ...props }: StatusBadgeProps) {
  return (
    <Badge
      {...props}
      className={cn('border-transparent', statusToneRecipe[tone], className)}
      variant="outline"
    />
  )
}
