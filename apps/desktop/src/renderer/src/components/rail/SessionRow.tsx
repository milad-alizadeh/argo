import { SESSION_STATUS, StatusDot } from '@/components/ui'
import type { SessionView } from '@/sessionStore'

// Molecule: one Session as a flat inset card (the wireframe's `.srow`). Status is
// carried by a leading icon, a trailing word, and a glowing dot; the CLI sits on the
// meta line. Richer per-row data (context %, tokens, elapsed) arrives with later tickets.
export function SessionRow({ session }: { session: SessionView }): React.JSX.Element {
  const { label, textClass, Icon } = SESSION_STATUS[session.status]
  return (
    <li className="rounded-lg border border-inset-hair bg-inset px-3 py-2 transition-colors hover:bg-accent">
      <div className="flex items-center gap-2">
        <Icon weight="light" aria-hidden className={`size-4 shrink-0 ${textClass}`} />
        <span className="flex-1 truncate font-medium text-foreground text-sm">{session.title}</span>
        <span className={`text-xs ${textClass}`}>{label}</span>
        <StatusDot status={session.status} decorative />
      </div>
      <div className="mt-1 text-muted-foreground text-xs uppercase tracking-wide">
        {session.cli}
      </div>
    </li>
  )
}
