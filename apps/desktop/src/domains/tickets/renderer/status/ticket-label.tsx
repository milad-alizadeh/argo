// Provider color tints an opaque surface; native foreground keeps the label readable.
import type { CSSProperties } from 'react'
import type { TicketLabel as Label } from '@/domains/tickets/api/ticket'
import { Badge } from '@/platform/renderer/components/ui/badge'

const TINTED =
  'bg-[color-mix(in_oklab,var(--ticket-label)_var(--ticket-label-fill-mix),var(--background))] text-foreground'

export function TicketLabel({ label }: { label: Label }) {
  if (label.color === null) return <Badge variant="outline">{label.name}</Badge>
  const tint = { '--ticket-label': `#${label.color}` } as CSSProperties
  return (
    <Badge className={TINTED} style={tint} variant="secondary">
      {label.name}
    </Badge>
  )
}
