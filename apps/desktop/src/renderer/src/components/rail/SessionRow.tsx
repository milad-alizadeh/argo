import { StatusDot } from '@/components/ui'
import type { SessionView } from '@/sessionStore'

// Molecule: one Session on the rail — status dot, title, and the CLI it runs.
export function SessionRow({ session }: { session: SessionView }): React.JSX.Element {
  return (
    <li className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent">
      <StatusDot status={session.status} />
      <span className="flex-1 truncate text-sm text-foreground">{session.title}</span>
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{session.cli}</span>
    </li>
  )
}
