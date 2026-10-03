import Ansi from 'ansi-to-react'
import React, { type HTMLAttributes, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { cn } from '@/platform/renderer/lib/utils'
import './terminal.css'
import { useCopyFeedback } from './code-block-copy-button'

type TerminalContextValue = {
  autoScroll: boolean
  isStreaming: boolean
  output: string
  variant: 'default' | 'embedded'
}

const TerminalContext = React.createContext<TerminalContextValue>({
  autoScroll: true,
  isStreaming: false,
  output: '',
  variant: 'default',
})

function TerminalHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border px-4 py-2',
        className,
      )}
      {...props}
    />
  )
}

function TerminalTitle({
  children = 'Terminal',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('type-body flex items-center gap-2 text-muted-foreground', className)}
      {...props}
    >
      <Icon name="shell-output" size="control" />
      {children}
    </div>
  )
}

export function TerminalCopyButton() {
  const { t } = useTranslation()
  const { output } = useContext(TerminalContext)
  const { announcement, iconName, copy } = useCopyFeedback()
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={t('terminal.copy')}
      className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={() => void copy(output)}
    >
      <Icon name={iconName} size="control" />
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </Button>
  )
}

export function TerminalContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { isStreaming, output, variant } = useContext(TerminalContext)
  return (
    <div
      className={cn(
        'terminal-output type-code overflow-auto p-4',
        variant === 'embedded' ? 'min-h-0 flex-1' : 'max-h-96',
        className,
      )}
      {...props}
    >
      <pre className="whitespace-pre-wrap break-words">
        <Ansi useClasses>{output}</Ansi>
        {isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground" />
        )}
      </pre>
    </div>
  )
}

export type TerminalProps = HTMLAttributes<HTMLDivElement> & {
  autoScroll?: boolean
  isStreaming?: boolean
  output: string
  variant?: 'default' | 'embedded'
}

const terminalFrameRecipes = {
  default: 'rounded-lg border bg-card text-foreground',
  embedded: 'rounded-none border-0 bg-transparent text-inherit',
} as const

export function Terminal({
  autoScroll = true,
  children,
  className,
  isStreaming = false,
  output,
  variant = 'default',
  ...props
}: TerminalProps) {
  const context = useMemo(
    () => ({ autoScroll, isStreaming, output, variant }),
    [autoScroll, isStreaming, output, variant],
  )
  return (
    <TerminalContext.Provider value={context}>
      <div
        className={cn('flex flex-col overflow-hidden', terminalFrameRecipes[variant], className)}
        {...props}
      >
        {children ?? (
          <>
            <TerminalHeader>
              <TerminalTitle />
              <TerminalCopyButton />
            </TerminalHeader>
            <TerminalContent />
          </>
        )}
      </div>
    </TerminalContext.Provider>
  )
}
