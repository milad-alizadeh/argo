import { CompassIcon } from '@phosphor-icons/react'

// Molecule: the rail's empty state — no Session is observed yet (issue #3).
export function EmptyRail(): React.JSX.Element {
  return (
    <div className="flex flex-1 select-none flex-col items-center justify-center gap-3 px-4 text-center">
      <CompassIcon weight="light" size={28} className="text-muted-foreground/70" />
      <p className="text-muted-foreground text-row">No Sessions observed yet.</p>
    </div>
  )
}
