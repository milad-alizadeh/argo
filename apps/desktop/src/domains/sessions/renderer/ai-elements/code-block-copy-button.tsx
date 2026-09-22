import React, { type ComponentProps, useCallback, useContext, useState } from 'react'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { cn } from '@/platform/renderer/lib/utils'
import { CodeBlockContext } from './code-block'

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & { timeout?: number }

export function CodeBlockCopyButton({
  children,
  className,
  timeout = 2000,
  ...props
}: CodeBlockCopyButtonProps) {
  const code = useContext(CodeBlockContext)
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), timeout)
  }, [code, timeout])
  return React.createElement(
    Button,
    {
      type: 'button',
      size: 'icon',
      variant: 'ghost',
      className: cn('shrink-0', className),
      onClick: copy,
      ...props,
    },
    children ?? React.createElement(Icon, { name: copied ? 'confirmed' : 'copy', size: 'control' }),
  )
}
