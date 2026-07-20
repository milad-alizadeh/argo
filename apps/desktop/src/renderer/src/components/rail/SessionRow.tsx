import { RAIL_ICON, STATUS_TONE, Status, Text } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { SessionView } from '@/sessionStore'
import { SESSION_STATUS } from '@/ship'

// Organism: one Session as a flat inset card (the wireframe's `.srow`). The word, tone and
// icon are all read off the ship vocabulary here — the atoms below take presentation only.
// The CLI sits on the meta line; richer per-row data (context %, tokens, elapsed) arrives
// with later tickets.
export function SessionRow({ session }: { session: SessionView }): React.JSX.Element {
  const { word, tone, icon } = SESSION_STATUS[session.status]
  const Icon = RAIL_ICON[icon]
  return (
    <li className="rounded-lg border border-inset-hair bg-inset px-3 py-2 transition-colors hover:bg-accent">
      <div className="flex items-center gap-2">
        <Icon weight="light" aria-hidden className={cn('size-4 shrink-0', STATUS_TONE[tone])} />
        <Text variant="row-strong" className="flex-1 truncate text-foreground">
          {session.title}
        </Text>
        <Status word={word} tone={tone} />
      </div>
      <Text as="div" variant="meta" className="mt-1 text-muted-foreground">
        {session.cli}
      </Text>
    </li>
  )
}
