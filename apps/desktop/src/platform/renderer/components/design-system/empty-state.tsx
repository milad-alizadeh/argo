import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty'

type EmptyStateProps = Omit<ComponentProps<typeof Empty>, 'children'> & {
  action?: ReactNode
  actionClassName?: string
  description?: ReactNode
  media: ReactNode
  mediaClassName?: string
  size?: 'compact' | 'full'
  title: ReactNode
}

const EMPTY_STATE_SIZE_CLASSES = {
  compact: 'flex-none p-4 py-8',
  full: 'h-full p-6',
} satisfies Record<NonNullable<EmptyStateProps['size']>, string>

export function EmptyState({
  action,
  actionClassName,
  className,
  description,
  media,
  mediaClassName,
  size = 'full',
  title,
  ...props
}: EmptyStateProps) {
  return (
    <Empty
      className={cn('rounded-none border-0 md:p-6', EMPTY_STATE_SIZE_CLASSES[size], className)}
      {...props}
    >
      <EmptyHeader>
        <EmptyMedia className={mediaClassName} variant="icon">
          {media}
        </EmptyMedia>
        <EmptyTitle
          aria-level={2}
          className="type-title font-heading text-foreground"
          role="heading"
        >
          {title}
        </EmptyTitle>
        {description === undefined ? null : (
          <EmptyDescription className="type-body text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary">
            {description}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {action === undefined ? null : (
        <EmptyContent className={actionClassName}>{action}</EmptyContent>
      )}
    </Empty>
  )
}
