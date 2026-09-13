import { CheckIcon, CopyIcon } from 'lucide-react'
import React, {
  type ComponentProps,
  type CSSProperties,
  type HTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  type BundledLanguage,
  type BundledTheme,
  createHighlighter,
  type HighlighterGeneric,
} from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { Button } from '@/renderer/components/ui/button'
import { cn } from '@/renderer/lib/utils'

const THEMES = { light: 'github-light', dark: 'github-dark-default' } as const

type Token = { content: string; light?: string; dark?: string }

// The JavaScript engine because the renderer's CSP refuses the WebAssembly the default one
// compiles. Grammars load on first use, so the highlighter starts with none.
let highlighter: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null

async function highlight(code: string, language: BundledLanguage): Promise<Token[][]> {
  highlighter ??= createHighlighter({
    engine: createJavaScriptRegexEngine(),
    langs: [],
    themes: Object.values(THEMES),
  })
  const loaded: HighlighterGeneric<BundledLanguage, BundledTheme> = await highlighter
  await loaded.loadLanguage(language)
  return loaded.codeToTokensWithThemes(code, { lang: language, themes: THEMES }).map((line) =>
    line.map((token) => ({
      content: token.content,
      light: token.variants.light?.color,
      dark: token.variants.dark?.color,
    })),
  )
}

const CodeBlockContext = React.createContext('')

// Plain and highlighted draw the same line boxes and take colour alone from the highlighter, never
// a font style, so the height measured before highlighting is the height after it (ADR-0035 rule 2).
function HighlightedCode({ code, language }: { code: string; language: BundledLanguage | null }) {
  // One trailing newline ends the fence rather than adding a line to it.
  const text = code.replace(/\n$/, '')
  const lines = text.split('\n')
  const [tokens, setTokens] = useState<Token[][] | null>(null)
  useEffect(() => {
    setTokens(null)
    if (language === null) return
    let current = true
    highlight(text, language).then(
      (value) => {
        if (current && value.length === text.split('\n').length) setTokens(value)
      },
      // A grammar this engine cannot compile leaves the block as the plain code it already is.
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [text, language])
  let lineOffset = 0
  return (
    <pre className="m-0 overflow-auto p-4 text-sm">
      <code className="font-mono text-sm" data-highlighted={tokens !== null}>
        {lines.map((line, index) => {
          const lineKey = lineOffset
          let tokenOffset = lineOffset
          lineOffset += line.length + 1
          const lineTokens = tokens?.[index] ?? [{ content: line }]
          return (
            <span key={lineKey} className="block min-h-[1lh]">
              {lineTokens.map((token) => {
                const tokenKey = tokenOffset
                tokenOffset += token.content.length
                return (
                  <span
                    key={tokenKey}
                    className="text-(--shiki-light) dark:text-(--shiki-dark)"
                    style={
                      { '--shiki-light': token.light, '--shiki-dark': token.dark } as CSSProperties
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
  // `null` is a language Argo does not know, drawn as plain code.
  language: BundledLanguage | null
}

export function CodeBlock({ children, className, code, language, ...props }: CodeBlockProps) {
  return (
    <CodeBlockContext.Provider value={code}>
      <div
        className={cn(
          'group relative w-full overflow-hidden rounded-md border bg-background text-foreground',
          className,
        )}
        data-language={language ?? 'plain'}
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
