'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/platform/renderer/lib/utils'

export type TaskItemProps = ComponentProps<'div'>

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
  <div className={cn('type-body text-muted-foreground', className)} {...props}>
    {children}
  </div>
)
