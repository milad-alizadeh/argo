import { cn } from 'cn'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Icon, type IconName } from './icon/icon'
import { Button } from './ui/button'

type SharedProps = {
  children: ReactNode
  className?: string
  icon?: IconName
}

type PageHeadingTitleProps = SharedProps &
  Omit<ComponentPropsWithoutRef<'h1'>, 'children' | 'className'> & {
    as?: 'h1'
  }

type PageHeadingActionProps = SharedProps &
  Omit<ComponentPropsWithoutRef<typeof Button>, 'children' | 'className' | 'size' | 'variant'> & {
    as: 'button'
  }

export type PageHeadingProps = PageHeadingTitleProps | PageHeadingActionProps

function PageHeadingContent({ children, icon }: Pick<SharedProps, 'children' | 'icon'>) {
  return (
    <>
      {icon ? <Icon data-icon="inline-start" name={icon} /> : null}
      <span className="truncate">{children}</span>
    </>
  )
}

// Page headers share one visual title whether the title names the page or navigates to its parent.
// The element keeps the correct document or control semantics for each use.
export function PageHeading(props: PageHeadingProps) {
  if (props.as === 'button') {
    const { as: _as, children, className, icon, ...buttonProps } = props
    return (
      <Button
        className={cn('min-w-0 type-heading', className)}
        size="sm"
        variant="ghost"
        {...buttonProps}
      >
        <PageHeadingContent icon={icon}>{children}</PageHeadingContent>
      </Button>
    )
  }

  const { as: _as, children, className, icon, ...headingProps } = props
  return (
    <h1
      className={cn(
        'flex min-w-0 items-center gap-(--spacing-shell-tight) type-heading',
        className,
      )}
      {...headingProps}
    >
      <PageHeadingContent icon={icon}>{children}</PageHeadingContent>
    </h1>
  )
}
