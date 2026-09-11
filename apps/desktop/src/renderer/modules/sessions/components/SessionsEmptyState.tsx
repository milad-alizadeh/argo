import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../../components/ui/empty'

type SessionsEmptyStateProps = {
  title: string
  /** What would put something here. Left out when the title already says all there is. */
  description?: string
}

// Every "there is nothing here" in this slice, drawn as shadcn's Empty: the Roster with no
// Sessions on the machine, a Session with nothing said in it, the archive with nothing in it. One
// component, because they are one reading — the place is real and it holds nothing — and a
// sentence in a different shape each time would read as a different kind of answer.
export function SessionsEmptyState({ title, description }: SessionsEmptyStateProps) {
  return (
    <Empty data-component="SessionsEmptyState">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description === undefined ? null : <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  )
}
