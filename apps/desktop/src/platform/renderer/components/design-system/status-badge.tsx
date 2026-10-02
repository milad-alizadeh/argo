import type { ComponentPropsWithRef } from 'react'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { cn } from '@/platform/renderer/lib/utils'
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
