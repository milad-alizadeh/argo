import { cn } from '@/lib/utils'
import { StatusDot, Text } from '@/shared/components/ui'
import type { RosterRow } from '../sessionsRoomModel'

// A plane, not a flat inset card: the rail's rows float in the lit scene on their own depth
// (`cockpit-penumbra-reference.html`, `#rail > .plane`). Selection is the ONE thing that brightens
// it — no plane tints or glows by state, because the dot already said it.
const ROW_PLANE = 'block w-full plane px-region py-inset text-left'

/**
 * Molecule: one session as the rail draws it — `dot · name · word` over `model · branch`.
 *
 * State is carried entirely by the dot's colour; the word stays neutral dim text and is cased by
 * the eyebrow type role rather than in TS, because the registry writes its words lowercase and how
 * a surface cases them is the surface's own type decision. Dot and word are deliberately NOT the
 * `Status` molecule: that pairs them, and here the name sits between them.
 */
export function SessionRow({
  row,
  onSelect,
}: {
  /** The row, already derived by `buildSessionsRoomModel` — a component grades nothing itself. */
  row: RosterRow
  /** Select this session by id. The row holds no selection state; absent, it is inert (the
   * read-only stories). */
  onSelect?: (id: string) => void
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        data-component="SessionRow"
        onClick={() => onSelect?.(row.id)}
        aria-current={row.selected ? 'true' : undefined}
        className={cn(
          ROW_PLANE,
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          row.selected && 'plane-lit',
          // Ghosted, so read-only awareness looks different from a session you can drive. A
          // brightness step, which is the only channel depth is allowed to use.
          row.external && 'plane-recede-1',
        )}
      >
        <div className="flex items-center gap-snug">
          <StatusDot
            tone={row.dot.tone}
            hollow={row.dot.hollow}
            glow={row.dot.glow}
            pulse={row.pulse}
          />
          <Text variant="row-strong" className="min-w-0 flex-1 truncate text-foreground">
            {row.name}
          </Text>
          <Text variant="eyebrow" className="shrink-0 text-foreground-soft">
            {row.word}
          </Text>
        </div>
        <div className="mt-snug flex min-w-0 items-center gap-snug">
          <Text variant="code-inline" className="shrink-0 text-foreground-soft">
            {row.model}
          </Text>
          <Text aria-hidden variant="code-inline" className="text-foreground-faint">
            ·
          </Text>
          <Text variant="code-inline" className="min-w-0 truncate text-foreground-faint">
            {row.place}
          </Text>
        </div>
      </button>
    </li>
  )
}
