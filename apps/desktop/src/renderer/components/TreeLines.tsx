// The lines that draw a flat list of rows as a tree. One level of indent is one chevron wide, so a
// branch runs straight down from its parent's chevron and turns into each child.
const LINE = 'pointer-events-none absolute bg-border'
// A row's line crosses the 1px gap to the row below.
const DOWN = `${LINE} left-1/2 top-0 -bottom-px w-px`
const ANCHOR = 'top-[var(--ticket-tree-anchor)]'

// `rails[column]` is true while the branch in that ancestor column runs on below this row; the last
// column is this row's own branch, which turns into it.
export function TreeRails({ rails }: { rails: readonly boolean[] }) {
  const [runsOn, ...deeper] = rails
  if (runsOn === undefined) return null
  const own = deeper.length === 0
  return (
    <>
      <span aria-hidden="true" className="relative w-(--size-icon-control) shrink-0 self-stretch">
        {runsOn ? <span className={DOWN} /> : null}
        {own && !runsOn ? (
          <span className={`${LINE} bottom-auto left-1/2 top-0 h-(--ticket-tree-anchor) w-px`} />
        ) : null}
        {own ? <span className={`${ANCHOR} ${LINE} left-1/2 right-0 h-px`} /> : null}
      </span>
      <TreeRails rails={deeper} />
    </>
  )
}

// The branch leaving an open parent, from under its chevron to the row below.
export function TreeStem() {
  return (
    <span
      aria-hidden="true"
      className={`${LINE} left-1/2 top-[calc(var(--ticket-tree-anchor)+var(--size-icon-meta)/2)] -bottom-px w-px`}
    />
  )
}

// A leaf's branch runs on through the empty chevron column to its title.
export function TreeTwig() {
  return <span aria-hidden="true" className={`${ANCHOR} ${LINE} left-0 right-0 h-px`} />
}
