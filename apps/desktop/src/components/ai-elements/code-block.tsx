import { CheckIcon, CopyIcon } from 'lucide-react'
import React, {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type HTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { type BundledLanguage, createHighlighter, type ThemedToken } from 'shiki'
import { Button } from '@/renderer/components/ui/button'
import { cn } from '@/renderer/lib/utils'

const highlighter = createHighlighter({
  langs: ['go', 'hcl', 'ruby', 'typescript'],
  themes: ['github-dark', 'github-light'],
})

const CodeBlockContext = createContext('')

function HighlightedCode({ code, language }: { code: string; language: BundledLanguage }) {
  const [lines, setLines] = useState<ThemedToken[][]>()
  useEffect(() => {
    let current = true
    void highlighter.then((value) => {
      if (!current) return
      setLines(
        value.codeToTokens(code, {
          lang: language,
          themes: { dark: 'github-dark', light: 'github-light' },
        }).tokens,
      )
    })
    return () => {
      current = false
    }
  }, [code, language])
  if (!lines)
    return (
      <pre className="m-0 overflow-auto p-4 text-sm">
        <code className="font-mono text-sm">{code}</code>
      </pre>
    )
  let lineOffset = 0
  return (
    <pre className="m-0 overflow-auto p-4 text-sm">
      <code className="font-mono text-sm">
        {lines.map((line) => {
          const lineKey = lineOffset
          let tokenOffset = lineOffset
          lineOffset += line.reduce((length, token) => length + token.content.length, 0) + 1
          return (
            <span key={lineKey} className="block min-h-[1lh]">
              {line.map((token) => {
                const tokenKey = tokenOffset
                tokenOffset += token.content.length
                return (
                  <span
                    key={tokenKey}
                    className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]"
                    style={
                      {
                        backgroundColor: token.bgColor,
                        color: token.color,
                        ...token.htmlStyle,
                      } as CSSProperties
                    }
                  >
                    {token.content}
                  </span>
                )
              })}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string
  language: BundledLanguage
}

export function CodeBlock({ children, className, code, language, ...props }: CodeBlockProps) {
  return (
    <CodeBlockContext.Provider value={code}>
      <div
        className={cn(
          'group relative w-full overflow-hidden rounded-md border bg-background text-foreground',
          className,
        )}
        data-language={language}
        {...props}
      >
        {children}
        <HighlightedCode code={code} language={language} />
      </div>
    </CodeBlockContext.Provider>
  )
}

export function CodeBlockHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b bg-muted/80 px-3 py-2 text-xs text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function CodeBlockTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}

export function CodeBlockFilename({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('font-mono', className)} {...props} />
}

export function CodeBlockActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-my-1 -mr-1 flex items-center gap-2', className)} {...props} />
}

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
  const Icon = copied ? CheckIcon : CopyIcon
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn('shrink-0', className)}
      onClick={copy}
      {...props}
    >
      {children ?? <Icon className="size-4" />}
    </Button>
  )
}
