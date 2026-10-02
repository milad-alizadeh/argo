import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Icon, type IconName } from '../icon/icon'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { noticeToneRecipe } from './tone-recipes'

const NOTICE_SLOTS = {
  root: 'min-w-0',
  title: 'min-w-0 wrap-anywhere text-current',
  description: 'min-w-0 wrap-anywhere text-foreground [&_a]:text-primary',
  icon: 'text-current',
}

type NoticeProps = Omit<ComponentPropsWithRef<typeof Alert>, 'variant' | 'children'> & {
  tone: keyof typeof noticeToneRecipe
  icon: IconName
  heading?: ReactNode
  children: ReactNode
}

export function Notice({ className, tone, icon, heading, children, ...props }: NoticeProps) {
  return (
    <Alert {...props} className={cn(NOTICE_SLOTS.root, noticeToneRecipe[tone], className)}>
      <Icon className={NOTICE_SLOTS.icon} name={icon} size="primitive" />
      {heading ? <AlertTitle className={NOTICE_SLOTS.title}>{heading}</AlertTitle> : null}
      <AlertDescription className={NOTICE_SLOTS.description}>{children}</AlertDescription>
    </Alert>
  )
}
