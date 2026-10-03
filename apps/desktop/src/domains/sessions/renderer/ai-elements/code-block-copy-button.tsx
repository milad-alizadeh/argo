import React, {
  type ComponentPropsWithRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { cn } from '@/platform/renderer/lib/utils'
import { CodeBlockContext } from './code-block'

export type CodeBlockCopyButtonProps = ComponentPropsWithRef<typeof Button> & { timeout?: number }
type CodeBlockClickHandler = NonNullable<ComponentPropsWithRef<typeof Button>['onClick']>
type CopyFeedback = 'idle' | 'copied' | 'failed'
const feedbackIcons: Record<CopyFeedback, IconName> = {
  idle: 'copy',
  copied: 'confirmed',
  failed: 'warning',
}

export function useCopyFeedback() {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState<CopyFeedback>('idle')
  const timer = useRef<number | null>(null)
  const attempt = useRef(0)

  useEffect(
    () => () => {
      attempt.current += 1
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(async (text: string, timeout = 2000) => {
    const currentAttempt = ++attempt.current
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null

    let result: CopyFeedback = 'copied'
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      result = 'failed'
    }

    if (currentAttempt !== attempt.current) return
    setFeedback(result)
    timer.current = window.setTimeout(() => {
      if (currentAttempt !== attempt.current) return
      timer.current = null
      setFeedback('idle')
    }, timeout)
  }, [])

  const announcements: Record<CopyFeedback, string> = {
    idle: '',
    copied: t('copy.copied'),
    failed: t('copy.failed'),
  }
  return { announcement: announcements[feedback], iconName: feedbackIcons[feedback], copy }
}

export function CodeBlockCopyButton({
  children,
  className,
  onClick,
  timeout = 2000,
  ...props
}: CodeBlockCopyButtonProps) {
  const code = useContext(CodeBlockContext)
  const { announcement, iconName, copy } = useCopyFeedback()
  const handleClick: CodeBlockClickHandler = useCallback(
    (event) => {
      onClick?.(event)
      if (!event.defaultPrevented && !event.currentTarget.disabled) void copy(code, timeout)
    },
    [code, copy, onClick, timeout],
  )
  return React.createElement(
    Button,
    {
      type: 'button',
      size: 'icon-sm',
      variant: 'ghost',
      className: cn('shrink-0', className),
      onClick: handleClick,
      ...props,
    },
    children ?? <Icon name={iconName} size="control" />,
    <span aria-live="polite" className="sr-only">
      {announcement}
    </span>,
  )
}
