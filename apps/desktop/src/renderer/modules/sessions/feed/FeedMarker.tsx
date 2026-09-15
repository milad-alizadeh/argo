import { ChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/renderer/components/ui/collapsible'
import { Marker, MarkerContent, MarkerIcon, markerVariants } from '@/renderer/components/ui/marker'
import type { SessionFeedRow } from '../types'

type MarkerRow = Extract<SessionFeedRow, { shape: 'marker' }>

const MARKER_LABEL: Record<MarkerRow['marker'], string> = {
  compacted: 'Conversation compacted',
  interrupted: 'Interrupted',
}

// A transcript boundary, drawn as a divider rather than a bubble so a reader never mistakes it
// for something either party said (#2206). A compaction boundary can carry the summary the CLI
// wrote to resume from, the only surviving record of what the compacted history held; a reader
// expands it to see that text rather than losing it entirely.
export function FeedMarker({ row }: { row: MarkerRow }) {
  if (row.summary === null)
    return (
      <Marker variant="separator" className="py-2 type-meta">
        <MarkerContent>{MARKER_LABEL[row.marker]}</MarkerContent>
      </Marker>
    )
  return (
    <Collapsible className="py-2">
      <CollapsibleTrigger className={`group ${markerVariants({ variant: 'separator' })}`}>
        <MarkerContent>{MARKER_LABEL[row.marker]}</MarkerContent>
        <MarkerIcon>
          <ChevronDown className="transition-transform group-data-[panel-open]:rotate-180" />
        </MarkerIcon>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-2 whitespace-pre-wrap type-body text-muted-foreground">{row.summary}</p>
      </CollapsibleContent>
    </Collapsible>
  )
}
