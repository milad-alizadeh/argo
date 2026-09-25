// A provider label in its own colour: the colour tints an opaque surface and leans the text toward
// it from the foreground, so overlapping labels never blend into a third colour.
import type { CSSProperties } from 'react'
import type { TicketLabel as Label } from '@/domains/tickets/contract/contract'
import { Badge } from '@/platform/renderer/components/ui/badge'

const TINTED =
  'bg-[color-mix(in_oklab,var(--ticket-label)_var(--ticket-label-fill-mix),var(--background))] text-[color-mix(in_oklab,var(--ticket-label)_var(--ticket-label-lean),var(--foreground))]'

export function TicketLabel({ label }: { label: Label }) {
  if (!label.color) return <Badge variant="secondary">{label.name}</Badge>
  const tint = { '--ticket-label': `#${label.color}` } as CSSProperties
  return (
    <Badge className={TINTED} style={tint} variant="secondary">
      {label.name}
    </Badge>
  )
}
