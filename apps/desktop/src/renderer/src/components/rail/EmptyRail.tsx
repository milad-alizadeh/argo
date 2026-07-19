import { CompassIcon } from '@phosphor-icons/react'

// Molecule: the rail's empty state — no Session is observed yet (issue #3).
export function EmptyRail(): React.JSX.Element {
  return (
    <div className="flex flex-1 select-none flex-col items-center justify-center gap-3">
      <CompassIcon weight="light" size={32} className="text-muted-foreground" />
      <p className="text-muted-foreground text-sm">No Sessions observed yet.</p>
    </div>
  )
}
