import { PlusIcon, Text } from '@/shared/components/ui'
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
  refusal = null,
}: {
  /** Spawn a zero-config session at the active project's root. Absent, the row is inert (the
   * read-only stories). */
  onSpawn?: () => void
  /** Why the last spawn did not happen, in the underlying tool's own words — `spawn claude ENOENT`
   * from node-pty, `no active project` from Argo. It sits under the row you pressed rather than in
   * chrome of its own, and `null` is the ordinary case: nothing refused. */
  refusal?: string | null
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <RailActionRow icon={PlusIcon} label="New session" onClick={onSpawn} />
      {refusal !== null && (
        // Verbatim: the tool said why, and rewording it would put Argo's guess where an observation
        // was. Announced, because ⌘N gives the keyboard user nothing else to notice.
        <Text as="p" role="status" variant="meta" className="px-region text-tone-red">
          {refusal}
        </Text>
      )}
    </div>
  )
}
