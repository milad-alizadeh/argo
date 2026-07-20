import { SESSION_ICON, STATUS_STATE, STATUS_TONE, Status, Text } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { SessionView } from '@/sessionStore'

// Molecule: one Session as a flat inset card (the wireframe's `.srow`). Status is carried
// by a leading icon plus the Status molecule (word + glowing dot); the CLI sits on the meta
// line. Richer per-row data (context %, tokens, elapsed) arrives with later tickets.
export function SessionRow({ session }: { session: SessionView }): React.JSX.Element {
  const Icon = SESSION_ICON[session.status]
  const { tone } = STATUS_STATE[session.status]
  return (
    <li className="rounded-lg border border-inset-hair bg-inset px-3 py-2 transition-colors hover:bg-accent">
      <div className="flex items-center gap-2">
        <Icon weight="light" aria-hidden className={cn('size-4 shrink-0', STATUS_TONE[tone])} />
        <Text variant="row-strong" className="flex-1 truncate text-foreground">
          {session.title}
        </Text>
        <Status state={session.status} />
      </div>
      <Text as="div" variant="meta" className="mt-1 text-muted-foreground">
        {session.cli}
      </Text>
    </li>
  )
}
