import React, { type CSSProperties, type HTMLAttributes, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { cn } from '@/platform/renderer/lib/utils'
import './terminal.css'
import { useCopyFeedback } from './code-block-copy-button'
import { formatTerminalOutput, type TerminalColor } from './terminal-format'

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

function outputColor(color: TerminalColor | null, channel: 'foreground' | 'background') {
  if (color === null) return {}
  switch (color.kind) {
    case 'protocol':
      return { className: `ansi-${color.name}-${channel === 'foreground' ? 'fg' : 'bg'}` }
    case 'rgb':
      return {
        style: {
          [channel === 'foreground' ? 'color' : 'backgroundColor']:
            `rgb(${color.channels.join(', ')})`,
        } satisfies CSSProperties,
      }
  }
}

function TerminalOutput({ output }: { output: string }) {
  const runs = useMemo(() => formatTerminalOutput(output), [output])
  let characterOffset = 0
  return (
    <code>
      {runs.map((run) => {
        const start = characterOffset
        characterOffset += run.text.length
        const foreground = outputColor(run.foreground, 'foreground')
        const background = outputColor(run.background, 'background')
        return (
          <span
            className={cn(
              foreground.className,
              background.className,
              run.background === null ? undefined : 'ansi-with-background',
              run.decoration === null ? undefined : `ansi-${run.decoration}`,
            )}
            key={start}
            style={{ ...foreground.style, ...background.style }}
          >
            {run.text}
          </span>
        )
      })}
    </code>
  )
}

export function TerminalContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { t } = useTranslation()
  const { isStreaming, output, variant } = useContext(TerminalContext)
  return (
    <section
      className={cn(
        'terminal-output type-code overflow-auto p-4',
        variant === 'embedded' ? 'min-h-0 flex-1' : 'max-h-96',
        className,
      )}
      aria-label={t('terminal.output')}
      tabIndex={0}
      {...props}
    >
      <pre className="whitespace-pre-wrap break-words">
        <TerminalOutput output={output} />
        {isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground" />
        )}
      </pre>
    </section>
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
