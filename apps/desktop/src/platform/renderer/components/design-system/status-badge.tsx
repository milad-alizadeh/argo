import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { subtleToneRecipe } from './tone-recipes'

type StatusBadgeProps = Omit<
  ComponentPropsWithRef<'span'>,
  'onClick' | 'onKeyDown' | 'onKeyUp' | 'tabIndex' | 'role'
> & { tone: keyof typeof subtleToneRecipe }

export function StatusBadge({ className, tone, ...props }: StatusBadgeProps) {
  return (
    <Badge
      {...props}
      className={cn('border-transparent', subtleToneRecipe[tone], className)}
      variant="outline"
    />
  )
}
