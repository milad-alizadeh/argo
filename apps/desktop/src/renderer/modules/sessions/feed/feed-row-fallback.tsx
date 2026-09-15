import { PromptText } from '../prompt/PromptText'
import type { SessionFeedRow } from '../types'
import { FeedDelegation } from './FeedDelegation'
import { FeedEvent } from './FeedEvent'

export function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

export function FeedPrompt({ text }: { text: string }) {
  return (
    <p
      className="max-w-full rounded-xl border border-transparent bg-muted px-3 py-2 type-prose sm:max-w-4/5"
      data-slot="bubble"
      data-variant="muted"
    >
      <span className="sr-only">You</span>
      <PromptText text={text} />
    </p>
  )
}

export function feedRowContent(
  row: Exclude<SessionFeedRow, { shape: 'tool' | 'tool-group' | 'prose' | 'ask' }>,
) {
  switch (row.shape) {
    case 'thought':
      return <PlainText text={row.text} />
    case 'command-output':
      return <PlainText text={row.text} />
    case 'event':
      return <FeedEvent row={row} />
    case 'delegation':
    case 'delegation-group':
      return <FeedDelegation row={row} />
    case 'source':
      return <p>{row.label}</p>
    case 'marker':
      return <p>{row.marker === 'compacted' ? 'Conversation compacted' : 'Interrupted'}</p>
    case 'unreadable':
      return <p>Part of this transcript is damaged, so Argo cannot show it.</p>
  }
}
