import { Plus, Search } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../../components/ui/input-group'
import { Skeleton } from '../../../components/ui/skeleton'
import { sessionFailureState } from '../sessionFailureState'
import type { SessionError, SessionsListed } from '../types'

export function rosterState(
  roster: SessionsListed | null,
  rosterError: SessionError | null,
  count: number,
) {
  if (rosterError !== null) return sessionFailureState(rosterError.code)
  if (roster === null) return 'loading'
  return count === 0 ? 'empty' : 'ready'
}

export function RosterLoading() {
  return (
    <div aria-label="Reading Sessions" className="space-y-4 px-5 py-4" role="status">
      {[0, 1, 2].map((index) => (
        <div key={index}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function SessionsSidebarHeader({
  onNew,
  onSearch,
  search,
}: {
  onNew: () => void
  onSearch: (search: string) => void
  search: string
}) {
  return (
    <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 pl-4 pr-(--spacing-shell-icon)">
      <InputGroup className="flex-1">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search Sessions"
          className="type-label"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search Sessions…"
          value={search}
        />
      </InputGroup>
      <div className="ml-(--spacing-shell-tight) flex items-center">
        <Button aria-label="New Session" onClick={onNew} size="icon-sm" variant="ghost">
          <Plus />
        </Button>
      </div>
    </header>
  )
}
