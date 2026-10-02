import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { statusToneRecipe } from './tone-recipes'

type StatusBadgeProps = Omit<
  ComponentPropsWithRef<'span'>,
  'onClick' | 'onKeyDown' | 'onKeyUp' | 'tabIndex' | 'role'
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
