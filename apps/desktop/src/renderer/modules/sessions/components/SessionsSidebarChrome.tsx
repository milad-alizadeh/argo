import { Plus, Search } from 'lucide-react'
import { Button } from '../../../components/ui/button'
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

export function SessionsSidebarHeader({ onNew }: { onNew: () => void }) {
  return (
    <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-4">
      <h2 className="flex-1 text-sm font-medium">Sessions</h2>
      <div className="flex items-center gap-1">
        <Button aria-label="New Session" onClick={onNew} size="icon-sm" variant="ghost">
          <Plus />
        </Button>
        <Button
          aria-label="Find a Session"
          className="disabled:opacity-100"
          disabled
          size="icon-sm"
          variant="ghost"
        >
          <Search />
        </Button>
      </div>
    </header>
  )
}
