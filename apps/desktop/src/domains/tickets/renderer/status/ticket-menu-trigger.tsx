import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'

// Pulls the named trigger's icon onto the value column outside the compact Badge treatment.
const NAMED_INSET = '-ml-[calc(--spacing(2)+var(--size-border))]'

// The element a Ticket field menu's trigger renders as: a Badge in metadata, a ghost button elsewhere.
export function ticketMenuTrigger(named: boolean, metadata: boolean) {
  if (metadata)
    return (
      <Badge
        className="relative z-10 @3xl:bg-transparent @3xl:text-muted-foreground"
        render={<button type="button" />}
        size="default"
        variant="secondary"
      />
    )
  return (
    <Button
      className={`relative z-10 shrink-0 text-muted-foreground ${named ? NAMED_INSET : ''}`}
      size={named ? 'xs' : 'icon-xs'}
      variant="ghost"
    />
  )
}
