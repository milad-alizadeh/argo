import { cn } from 'cn'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Icon, type IconName } from './icon/icon'

type SharedProps = {
  children: ReactNode
  className?: string
  icon?: IconName
}

type PageHeadingTitleProps = SharedProps &
  Omit<ComponentPropsWithoutRef<'h1'>, 'children' | 'className'> & {
    as?: 'h1'
  }

type PageHeadingLinkProps = SharedProps &
  Omit<ComponentPropsWithoutRef<'a'>, 'children' | 'className'> & {
    as: 'a'
  }

export type PageHeadingProps = PageHeadingTitleProps | PageHeadingLinkProps

const pageHeadingClass = 'flex min-w-0 items-center gap-(--spacing-shell-tight) type-heading'

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
  if (props.as === 'a') {
    const { as: _as, children, className, icon, ...linkProps } = props
    return (
      <a className={cn(pageHeadingClass, className)} {...linkProps}>
        <PageHeadingContent icon={icon}>{children}</PageHeadingContent>
      </a>
    )
  }

  const { as: _as, children, className, icon, ...headingProps } = props
  return (
    <h1 className={cn(pageHeadingClass, className)} {...headingProps}>
      <PageHeadingContent icon={icon}>{children}</PageHeadingContent>
    </h1>
  )
}
