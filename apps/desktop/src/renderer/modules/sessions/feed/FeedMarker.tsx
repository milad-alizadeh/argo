import { Marker, MarkerContent } from '@/renderer/components/ui/marker'
import type { SessionFeedRow } from '../types'

type MarkerRow = Extract<SessionFeedRow, { shape: 'marker' }>

const MARKER_LABEL: Record<MarkerRow['marker'], string> = {
  compacted: 'Conversation compacted',
  interrupted: 'Interrupted',
}

// A transcript boundary, drawn as a divider rather than a bubble so a reader never mistakes it
// for something either party said (#2206).
export function FeedMarker({ row }: { row: MarkerRow }) {
  return (
    <Marker variant="separator" className="py-2 type-meta">
      <MarkerContent>{MARKER_LABEL[row.marker]}</MarkerContent>
    </Marker>
  )
}
