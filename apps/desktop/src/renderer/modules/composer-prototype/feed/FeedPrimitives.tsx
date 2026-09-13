import type { ReactNode } from 'react'
import { Bubble, BubbleContent } from '@/renderer/components/ui/bubble'
import { Marker, MarkerContent } from '@/renderer/components/ui/marker'
import { Message, MessageContent, MessageHeader } from '@/renderer/components/ui/message'

export { FeedCode } from '../../sessions/feed/content/FeedCode'

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
  attachment,
  children,
  submitted = false,
}: {
  attachment?: ReactNode
  children: ReactNode
  submitted?: boolean
}) {
  return (
    <Message align="end" className="type-body">
      <MessageContent>
        <span className="sr-only">You</span>
        {submitted ? (
          <MessageHeader className="type-meta">Sending to Session…</MessageHeader>
        ) : null}
        {attachment}
        <Bubble variant="muted" className="max-w-full sm:max-w-4/5">
          <BubbleContent className="type-prose">{children}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}
