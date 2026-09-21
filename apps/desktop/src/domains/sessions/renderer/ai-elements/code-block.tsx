import React, { type CSSProperties, type HTMLAttributes, useEffect, useState } from 'react'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { type BundledLanguage, bundledLanguages } from 'shiki/langs'
import { xcodeCodeThemes } from '@/platform/renderer/components/xcode-code-theme'
import { cn } from '@/platform/renderer/lib/utils'

const THEMES = { light: 'xcode-light', dark: 'xcode-dark' } as const

type Token = { content: string; light?: string; dark?: string }

// The JavaScript engine because the renderer's CSP refuses the WebAssembly the default one
// compiles. Grammars load on first use, so the highlighter starts with none. The core build ships
// only the two themes imported here, where the full `shiki` entry would bundle every theme.
let highlighter: Promise<HighlighterCore> | null = null

async function highlight(code: string, language: BundledLanguage): Promise<Token[][]> {
  highlighter ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [],
    themes: xcodeCodeThemes,
  })
  const loaded = await highlighter
  await loaded.loadLanguage(bundledLanguages[language])
  return loaded.codeToTokensWithThemes(code, { lang: language, themes: THEMES }).map((line) =>
    line.map((token) => ({
      content: token.content,
      light: token.variants.light?.color,
      dark: token.variants.dark?.color,
    })),
  )
}

export const CodeBlockContext = React.createContext('')

// Plain and highlighted draw the same line boxes and take colour alone from the highlighter, never
// a font style, so the height measured before highlighting is the height after it (ADR-0035 rule 2).
type CodeLine = { className?: string; prefix?: React.ReactNode }

function HighlightedCode({
  code,
  language,
  line,
}: {
  code: string
  language: BundledLanguage | null
  line?: (index: number) => CodeLine | undefined
}) {
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
    <pre className="type-code m-0 overflow-x-hidden overflow-y-auto p-4">
      <code className="type-code" data-highlighted={tokens !== null}>
        {lines.map((lineText, index) => {
          const lineKey = lineOffset
          let tokenOffset = lineOffset
          lineOffset += lineText.length + 1
          const lineTokens = tokens?.[index] ?? [{ content: lineText }]
          const decoration = line?.(index)
          return (
            <span key={lineKey} className={cn('flex min-h-[1lh]', decoration?.className)}>
              {decoration?.prefix}
              {/* Code wraps rather than scrolling sideways, breaking a long token wherever it must. */}
              <span className="min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere">
                {lineTokens.map((token) => {
                  const tokenKey = tokenOffset
                  tokenOffset += token.content.length
                  return (
                    <span
                      key={tokenKey}
                      className="text-(--shiki-light) dark:text-(--shiki-dark)"
                      style={
                        {
                          '--shiki-light': token.light,
                          '--shiki-dark': token.dark,
                        } as CSSProperties
                      }
                    >
                      {token.content}
                    </span>
                  )
                })}
              </span>
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
  line?: (index: number) => CodeLine | undefined
}

export function CodeBlock({ children, className, code, language, line, ...props }: CodeBlockProps) {
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
        <HighlightedCode code={code} language={language} line={line} />
      </div>
    </CodeBlockContext.Provider>
  )
}

export function CodeBlockHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'type-meta flex items-center justify-between border-b bg-muted/80 px-3 py-2 text-muted-foreground',
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
  return <span className={cn('type-code', className)} {...props} />
}

export function CodeBlockActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-my-1 -mr-1 flex items-center gap-2', className)} {...props} />
}
