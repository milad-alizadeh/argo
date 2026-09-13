// A provider label in its own colour: the colour tints the fill and the edge, and leans the text
// toward it from the foreground, so it reads in both appearances.
import type { CSSProperties } from 'react'
import type { TicketLabel as Label } from '@/core/tickets/contract'
import { Badge } from '../../../components/ui/badge'

const TINTED =
  'border-[color-mix(in_oklab,var(--ticket-label)_45%,transparent)] bg-[color-mix(in_oklab,var(--ticket-label)_18%,transparent)] text-[color-mix(in_oklab,var(--ticket-label)_55%,var(--foreground))]'

export function TicketLabel({ label }: { label: Label }) {
  if (!label.color) return <Badge variant="outline">{label.name}</Badge>
  const tint = { '--ticket-label': `#${label.color}` } as CSSProperties
  return (
    <Badge className={TINTED} style={tint} variant="outline">
      {label.name}
    </Badge>
  )
}
