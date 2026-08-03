import { PlusIcon } from '@/shared/components/ui'
import { RailActionRow } from './RailActionRow'

/**
 * Molecule: `+ New session`, pinned at the top of the rail.
 *
 * It is the visible half of `⌘N`, so spawn is never keyboard-only. The quiet treatment it wears is
 * `RailActionRow`'s, shared with the archived footer at the other end of the rail: spawning is
 * always available, and a permanent CTA shouting for attention would spend the channel gold owns.
 */
export function NewSessionRow({
  onSpawn,
}: {
  /** Spawn a zero-config session at the active project's root. Absent, the row is inert (the
   * read-only stories). */
  onSpawn?: () => void
}): React.JSX.Element {
  return <RailActionRow icon={PlusIcon} label="New session" onClick={onSpawn} />
}
