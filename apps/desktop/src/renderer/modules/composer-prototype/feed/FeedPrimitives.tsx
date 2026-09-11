import type { ReactNode } from 'react'
import type { BundledLanguage } from 'shiki'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@/components/ai-elements/code-block'
import { Bubble, BubbleContent } from '@/renderer/components/ui/bubble'
import { Marker, MarkerContent } from '@/renderer/components/ui/marker'
import { Message, MessageContent, MessageHeader } from '@/renderer/components/ui/message'
import { CodeLanguageIcon, codeLanguageLabel, detectCodeLanguage } from './CodeLanguageIcon'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'

export function FeedBoundary({ children }: { children: ReactNode }) {
  return (
    <Marker variant="separator" className="py-2 type-meta">
      <MarkerContent>{children}</MarkerContent>
    </Marker>
  )
}

export function FeedTurn({ children }: { children: ReactNode }) {
  return (
    <Message className="type-body">
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
    <Message align="end" className="type-body">
      <MessageContent>
        <MessageHeader className="type-meta">
          You{submitted ? ' · Sending to Session…' : ''}
        </MessageHeader>
        <Bubble variant="muted" className="max-w-full sm:max-w-4/5">
          <BubbleContent className="type-prose">{children}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

export function FeedCode({ source, language }: { source: string; language?: string }) {
  const detectedLanguage = detectCodeLanguage(source, language)
  const languageLabel = codeLanguageLabel(detectedLanguage)
  const highlightedLanguage: BundledLanguage =
    detectedLanguage === 'unknown' ? 'hcl' : detectedLanguage
  return (
    <CodeBlock
      code={source}
      language={highlightedLanguage}
      className={`type-code-content min-w-0 bg-surface-raised ${FEED_CARD_RADIUS_CLASS}`}
    >
      <CodeBlockHeader className="bg-surface-inset type-meta">
        <CodeBlockTitle>
          <span role="img" aria-label={`${languageLabel} file`}>
            <CodeLanguageIcon language={detectedLanguage} />
          </span>
          <CodeBlockFilename>{languageLabel}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton aria-label="Copy code" className="size-7" />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  )
}
