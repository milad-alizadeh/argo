import { BrainIcon, TriangleAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Bubble, BubbleContent } from '../../../components/ui/bubble'
import { Item, ItemContent, ItemMedia, ItemTitle } from '../../../components/ui/item'
import { Marker, MarkerContent, MarkerIcon } from '../../../components/ui/marker'
import type { SessionFeedRow as SessionFeedRowData } from '../types'

type Row<Shape extends SessionFeedRowData['shape']> = Extract<SessionFeedRowData, { shape: Shape }>

// What the person typed: the one thing in the Feed drawn in a bubble, at the trailing edge, so
// who spoke is read off the shape and never off a label. It keeps its own line breaks and is not
// read as Markdown. A prompt of only whitespace is still a line the transcript holds, so its row
// stays, but a bubble around nothing would read as a message that failed to draw.
export function FeedPrompt({ text }: { text: string }) {
  const blank = text.trim().length === 0
  return (
    <Bubble align="end" variant={blank ? 'ghost' : 'muted'}>
      <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
    </Bubble>
  )
}

// A Thought (CONTEXT.md L3 · Thought) is never a Message, so it is a marker in the Feed and not
// prose: shadcn's "Thinking" marker, drawn on one line as #314 asks, and one line is also a height
// the measure pass reads once (ADR-0033). The CLI withholds most Thought text, so the word alone is
// common. The history is settled, so the marker stands still: the docs' shimmer is for thinking
// that is happening now, and every Thought here has already happened.
export function FeedThought({ row }: { row: Row<'thought'> }) {
  const { t } = useTranslation()
  const text = row.text.trim()
  return (
    <Marker>
      <MarkerIcon>
        <BrainIcon />
      </MarkerIcon>
      <MarkerContent className="truncate">
        {t('marks.thought')}
        {text.length > 0 ? ` ${text}` : null}
      </MarkerContent>
    </Marker>
  )
}

// A point in the Turn sequence rather than something said in it. A Compaction and a stopped Turn
// both divide the history before them from the history after, so both are the labelled separator.
export function FeedMarker({ row }: { row: Row<'marker'> }) {
  const { t } = useTranslation()
  return (
    <Marker variant="separator">
      <MarkerContent>{t(`marks.${row.marker}`)}</MarkerContent>
    </Marker>
  )
}

// A transcript line Argo could not read is an error, so it is shadcn's Item in the destructive
// ink rather than a quiet note. Its height is stated rather than laid out (ADR-0033 rule 1), so it
// is written on and the title is held to one line inside it.
export function FeedUnreadable({ height }: { height: number }) {
  const { t } = useTranslation()
  return (
    <Item
      className="flex-nowrap overflow-hidden border-destructive/40 py-0 text-destructive"
      size="xs"
      style={{ height: `${height}px` }}
      variant="outline"
    >
      <ItemMedia variant="icon">
        <TriangleAlertIcon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="block w-full truncate">{t('rowUnreadable')}</ItemTitle>
      </ItemContent>
    </Item>
  )
}
