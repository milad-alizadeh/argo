const ROWS = ['first', 'second', 'third', 'fourth'] as const

export function RosterSkeleton() {
  return (
    <>
      {ROWS.map((row) => (
        <div className="session-page__roster-skeleton" data-component="RosterSkeleton" key={row}>
          <i />
          <span>
            <i />
            <i />
          </span>
        </div>
      ))}
    </>
  )
}
