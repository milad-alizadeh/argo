import { cn } from '@/lib/utils'
import { Status } from './Status'
import { Text } from './Text'

// Molecule: the quiet one-line "doing now" strip that opens the story pane. One inset row —
// a leading icon, the current line, and, while the agent is running, a static `live` word +
// dot. "live" is the Status molecule with NO pulse: the screen's one animation budget belongs
// to the ribbon and the rail, never here.
export function NowLine({
  icon,
  line,
  live,
  className,
}: {
  /** The leading glyph — an already-rendered Icon atom the strip tones and keeps flush. */
  icon: React.ReactNode
  /** The one line, composed by the caller. May embed `code-inline` Text spans for paths and
   * counts; the strip truncates the whole line rather than wrapping it. */
  line: React.ReactNode
  /** Whether the agent is running — shows the static `live` word + dot at the trailing edge. */
  live: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-gap rounded-xl border border-inset-hair bg-inset px-3 py-gap',
        className,
      )}
    >
      <span className="inline-flex shrink-0 text-muted-foreground">{icon}</span>
      <Text as="div" variant="row" className="min-w-0 flex-1 truncate">
        {line}
      </Text>
      {live && <Status word="live" tone="run" />}
    </div>
  )
}
