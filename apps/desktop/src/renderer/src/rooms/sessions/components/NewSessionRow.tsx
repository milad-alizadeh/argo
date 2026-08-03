import { PlusIcon, Text } from '@/shared/components/ui'

/**
 * Molecule: `+ New session`, pinned at the top of the rail.
 *
 * Deliberately quiet and never a loud CTA — no plane, no fill, no accent: spawning is always
 * available, and a permanent button shouting for attention would spend the one channel gold owns.
 * It is the visible half of `⌘N`, so spawn is never keyboard-only.
 */
export function NewSessionRow({
  onSpawn,
}: {
  /** Spawn a zero-config session at the active project's root. Absent, the row is inert (the
   * read-only stories). */
  onSpawn?: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSpawn}
      className="flex w-full items-center gap-snug rounded-lg px-region py-row text-left text-foreground-faint transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <PlusIcon aria-hidden className="icon-sm" />
      <Text variant="row">New session</Text>
    </button>
  )
}
