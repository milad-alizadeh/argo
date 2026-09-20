// The share of a Ticket's children that are closed, as a ring that fills as they close. The fact
// itself is text beside it, for the eye and for a screen reader.
export function ChildProgress({ closed, total }: { closed: number; total: number }) {
  const share = total === 0 ? 0 : closed / total
  return (
    <svg aria-hidden="true" className="size-(--size-icon-meta) shrink-0" viewBox="0 0 16 16">
      <circle className="fill-none stroke-border" cx="8" cy="8" r="6" strokeWidth="2.5" />
      <circle
        className="fill-none stroke-current"
        cx="8"
        cy="8"
        pathLength={1}
        r="6"
        strokeDasharray={`${share} 1`}
        strokeWidth="2.5"
        transform="rotate(-90 8 8)"
      />
    </svg>
  )
}
