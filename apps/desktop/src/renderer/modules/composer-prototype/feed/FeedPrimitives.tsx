import { Check, Copy } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Bubble, BubbleContent } from '@/renderer/components/ui/bubble'
import { Button } from '@/renderer/components/ui/button'
import { Marker, MarkerContent } from '@/renderer/components/ui/marker'
import { Message, MessageContent, MessageHeader } from '@/renderer/components/ui/message'

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

export function FeedCode({ source, language = 'tsx' }: { source: string; language?: string }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <figcaption className="flex items-center justify-between border-b px-3 py-1.5 text-control text-muted-foreground">
        <span>{language}</span>
        <CopyFeedContent text={source} />
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-control leading-relaxed">
        <code>{source}</code>
      </pre>
    </figure>
  )
}
