import { Check, Copy } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Bubble, BubbleContent } from '@/renderer/components/ui/bubble'
import { Button } from '@/renderer/components/ui/button'
import { Marker, MarkerContent } from '@/renderer/components/ui/marker'
import { Message, MessageContent, MessageHeader } from '@/renderer/components/ui/message'
import { CodeLanguageIcon, codeLanguageLabel, detectCodeLanguage } from './CodeLanguageIcon'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'

export function FeedBoundary({ children }: { children: ReactNode }) {
  return (
    <Marker variant="separator" className="py-2 text-control">
      <MarkerContent>{children}</MarkerContent>
    </Marker>
  )
}

export function FeedTurn({ children }: { children: ReactNode }) {
  return (
    <Message className="text-body">
      <MessageContent className="gap-4">{children}</MessageContent>
    </Message>
  )
}

export function FeedPrompt({
  children,
  submitted = false,
}: {
  children: ReactNode
  submitted?: boolean
}) {
  return (
    <Message align="end" className="text-body">
      <MessageContent>
        <MessageHeader className="text-control">
          You{submitted ? ' · Sending to Session…' : ''}
        </MessageHeader>
        <Bubble variant="muted" className="max-w-full sm:max-w-4/5">
          <BubbleContent className="text-body">{children}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

export function CopyFeedContent({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const labels = { idle: 'Copy', copied: 'Copied', failed: 'Copy failed' }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
  }
  return (
    <Button size="xs" variant="ghost" className="text-control text-muted-foreground" onClick={copy}>
      {state === 'copied' ? (
        <Check className="!size-(--size-icon-inline)" />
      ) : (
        <Copy className="!size-(--size-icon-inline)" />
      )}
      {labels[state]}
    </Button>
  )
}

type SyntaxToken = { content: string; offset: number; tone: string }

const SYNTAX_TOKEN =
  /(\/\/.*|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|<\/?[A-Z][\w.]*|\b(?:async|await|const|export|from|function|import|interface|new|return|type)\b|\b(?:false|null|true|undefined)\b)/g

function syntaxTone(content: string) {
  if (content.startsWith('//')) return 'text-muted-foreground'
  if (/^["'`]/.test(content)) return 'text-emerald-700 dark:text-emerald-300'
  if (content.startsWith('<')) return 'text-sky-700 dark:text-sky-300'
  if (/^(false|null|true|undefined)$/.test(content)) return 'text-amber-700 dark:text-amber-300'
  return 'text-violet-700 dark:text-violet-300'
}

function syntaxTokens(line: string, lineOffset: number) {
  const tokens: SyntaxToken[] = []
  let cursor = 0
  for (const match of line.matchAll(SYNTAX_TOKEN)) {
    const matchOffset = match.index ?? cursor
    if (matchOffset > cursor) {
      tokens.push({
        content: line.slice(cursor, matchOffset),
        offset: lineOffset + cursor,
        tone: '',
      })
    }
    tokens.push({ content: match[0], offset: lineOffset + matchOffset, tone: syntaxTone(match[0]) })
    cursor = matchOffset + match[0].length
  }
  if (cursor < line.length) {
    tokens.push({ content: line.slice(cursor), offset: lineOffset + cursor, tone: '' })
  }
  return tokens
}

export function HighlightedCode({ source }: { source: string }) {
  let lineOffset = 0
  const lines = source.split('\n').map((line) => {
    const offset = lineOffset
    lineOffset += line.length + 1
    return { content: line, offset, tokens: syntaxTokens(line, offset) }
  })
  return (
    <code>
      {lines.map((line) => (
        <span key={line.offset} className="block min-h-[1lh]">
          {line.tokens.length === 0
            ? ' '
            : line.tokens.map((token) => (
                <span key={token.offset} className={token.tone}>
                  {token.content}
                </span>
              ))}
        </span>
      ))}
    </code>
  )
}

export function FeedCode({ source, language }: { source: string; language?: string }) {
  const detectedLanguage = detectCodeLanguage(source, language)
  const languageLabel = codeLanguageLabel(detectedLanguage)
  return (
    <figure className={`min-w-0 overflow-hidden border bg-card ${FEED_CARD_RADIUS_CLASS}`}>
      <figcaption className="flex items-center justify-between border-b px-3 py-1.5 text-control text-muted-foreground">
        <span
          role="img"
          className="grid size-6 place-items-center rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300"
          aria-label={`${languageLabel} file`}
          title={`${languageLabel} file`}
        >
          <CodeLanguageIcon language={detectedLanguage} />
        </span>
        <CopyFeedContent text={source} />
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-control leading-relaxed">
        <HighlightedCode source={source} />
      </pre>
    </figure>
  )
}
