import Ansi from 'ansi-to-react'
import { CheckIcon, CopyIcon, TerminalIcon } from 'lucide-react'
import React, {
  createContext,
  type HTMLAttributes,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { Button } from '@/renderer/components/ui/button'
import { cn } from '@/renderer/lib/utils'

type TerminalContextValue = {
  autoScroll: boolean
  isStreaming: boolean
  output: string
}

const TerminalContext = createContext<TerminalContextValue>({
  autoScroll: true,
  isStreaming: false,
  output: '',
})

export function TerminalHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-zinc-800 px-4 py-2',
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
    <div className={cn('flex items-center gap-2 text-sm text-zinc-400', className)} {...props}>
      <TerminalIcon className="size-4" />
      {children}
    </div>
  )
}

export function TerminalCopyButton() {
  const { output } = useContext(TerminalContext)
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [output])
  const Icon = copied ? CheckIcon : CopyIcon
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label="Copy terminal output"
      className="size-7 shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      onClick={copy}
    >
      <Icon className="size-4" />
    </Button>
  )
}

export function TerminalContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { isStreaming, output } = useContext(TerminalContext)
  return (
    <div
      className={cn('max-h-96 overflow-auto p-4 font-mono text-sm leading-relaxed', className)}
      {...props}
    >
      <pre className="whitespace-pre-wrap break-words">
        <Ansi>{output}</Ansi>
        {isStreaming && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-zinc-100" />}
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
          'flex flex-col overflow-hidden rounded-lg border bg-zinc-950 text-zinc-100',
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
