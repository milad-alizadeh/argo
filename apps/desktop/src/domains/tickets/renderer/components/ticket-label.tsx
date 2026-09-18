// A provider label in its own colour: the colour tints the fill and the edge, and leans the text
// toward it from the foreground, so it reads in both appearances.
import type { CSSProperties } from 'react'
import type { TicketLabel as Label } from '@/domains/tickets/contract/contract'
import { Badge } from '../../../../platform/renderer/components/ui/badge'

const TINTED =
  'border-[color-mix(in_oklab,var(--ticket-label)_var(--ticket-label-border-mix),transparent)] bg-[color-mix(in_oklab,var(--ticket-label)_var(--ticket-label-fill-mix),transparent)] text-[color-mix(in_oklab,var(--ticket-label)_var(--ticket-label-lean),var(--foreground))]'

export function TicketLabel({ label }: { label: Label }) {
  if (!label.color)
    return (
      <Badge className="type-meta" variant="outline">
        {label.name}
      </Badge>
    )
  const tint = { '--ticket-label': `#${label.color}` } as CSSProperties
  return (
    <Badge className={`type-meta ${TINTED}`} style={tint} variant="outline">
      {label.name}
    </Badge>
  )
}
