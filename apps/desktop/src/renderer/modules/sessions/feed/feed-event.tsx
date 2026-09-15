import { BellRing, FileInput, SlidersHorizontal, SquareTerminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SessionFeedRow } from '../types'

type FeedEventRow = Extract<SessionFeedRow, { shape: 'event' }>

const EVENT_PRESENTATION = {
  command: SquareTerminal,
  context: SlidersHorizontal,
  status: BellRing,
  transcript: FileInput,
} satisfies Record<FeedEventRow['event'], typeof BellRing>

export function FeedEvent({ row }: { row: FeedEventRow }) {
  const { t } = useTranslation('sessions')
  const Icon = EVENT_PRESENTATION[row.event]
  const label = t(`events.${row.event}.label`)
  return (
    <div
      className="flex min-w-0 items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 type-body"
      data-slot="feed-event"
    >
      <Icon
        aria-hidden="true"
        className="size-(--size-icon-control) shrink-0 text-muted-foreground"
      />
      <span className="shrink-0 font-medium text-foreground">{label}</span>
      {row.text === null ? null : (
        <span className="min-w-0 break-words text-muted-foreground">{row.text}</span>
      )}
    </div>
  )
}
