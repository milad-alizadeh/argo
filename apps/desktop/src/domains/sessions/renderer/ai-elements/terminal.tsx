import Ansi from 'ansi-to-react'
import React, { type HTMLAttributes, useCallback, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { cn } from '@/platform/renderer/lib/utils'
import './terminal.css'

type TerminalContextValue = {
  autoScroll: boolean
  isStreaming: boolean
  output: string
}

const TerminalContext = React.createContext<TerminalContextValue>({
  autoScroll: true,
  isStreaming: false,
  output: '',
})

export function TerminalHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
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

export function TerminalTitle({
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
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [output])
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={t('terminal.copy')}
      className="size-7 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={copy}
    >
      <Icon name={copied ? 'confirmed' : 'copy'} size="control" />
    </Button>
  )
}

export function TerminalContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { isStreaming, output } = useContext(TerminalContext)
  return (
    <div
      className={cn('terminal-output type-code max-h-96 overflow-auto p-4', className)}
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
}

export function Terminal({
  autoScroll = true,
  children,
  className,
  isStreaming = false,
  output,
  ...props
}: TerminalProps) {
  const context = useMemo(
    () => ({ autoScroll, isStreaming, output }),
    [autoScroll, isStreaming, output],
  )
  return (
    <TerminalContext.Provider value={context}>
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-lg border bg-card text-foreground',
          className,
        )}
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
