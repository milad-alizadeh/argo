import type { ComponentProps } from 'react'
import { cn } from '../lib/utils'
import { Button as PrimitiveButton } from './ui/button'

const buttonTextClasses = {
  default: 'text-primary-foreground',
  destructive: 'text-foreground',
  ghost: 'text-foreground',
  link: 'text-foreground',
  outline: 'text-foreground',
  secondary: 'text-foreground',
} as const

function Button({ className, variant, ...props }: ComponentProps<typeof PrimitiveButton>) {
  const resolvedVariant = variant ?? 'default'

  return (
    <PrimitiveButton
      className={cn(buttonTextClasses[resolvedVariant], className)}
      variant={resolvedVariant}
      {...props}
    />
  )
}

export { Button, buttonTextClasses }
