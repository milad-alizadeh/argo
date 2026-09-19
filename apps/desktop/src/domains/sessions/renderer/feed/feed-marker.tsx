import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/platform/renderer/components/ui/collapsible'
import {
  Marker,
  MarkerContent,
  MarkerIcon,
  markerVariants,
} from '@/platform/renderer/components/ui/marker'

type MarkerRow = Extract<SessionFeedRow, { shape: 'marker' }>

const MARKER_LABEL: Record<MarkerRow['marker'], 'marks.compacted' | 'marks.interrupted'> = {
  compacted: 'marks.compacted',
  interrupted: 'marks.interrupted',
}

// A transcript boundary, drawn as a divider rather than a bubble so a reader never mistakes it
// for something either party said (#2206). A compaction boundary can carry the summary the CLI
// wrote to resume from, the only surviving record of what the compacted history held; a reader
// expands it to see that text rather than losing it entirely.
export function FeedMarker({ row }: { row: MarkerRow }) {
  const { t } = useTranslation('sessions')
  const label = t(MARKER_LABEL[row.marker])
  if (row.summary === null)
    return (
      <Marker variant="separator" className="py-2 type-body">
        <MarkerContent>{label}</MarkerContent>
      </Marker>
    )
  return (
    <Collapsible className="py-2">
      <CollapsibleTrigger className={`group ${markerVariants({ variant: 'separator' })} type-body`}>
        <MarkerContent>{label}</MarkerContent>
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
