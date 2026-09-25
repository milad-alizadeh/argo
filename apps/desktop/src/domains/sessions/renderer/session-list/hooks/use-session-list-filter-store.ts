import { useSearchParams } from 'react-router'
import type { RosterStatus as SessionListStatus } from '@/domains/sessions/renderer/model/roster-status'

// Which Sessions the Session list shows. The Archive used to be a disclosure row inside the list, which
// made it a place in the list rather than a way of reading it; it is a filter over one list now.
// The type is the search contract's own (#2375): search and the SessionList/Archive scope by the same
// three values, so one definition serves all of them.
export type { SessionListStatus }

export function useSessionListStatus(): SessionListStatus {
  const [params] = useSearchParams()
  const status = params.get('status')
  return status === 'archived' || status === 'all' ? status : 'active'
}

export function useSetSessionListStatus(): (status: SessionListStatus) => void {
  const [, setParams] = useSearchParams()
  return (status) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (status === 'active') next.delete('status')
      else next.set('status', status)
      return next
    })
}

// Whether the current filter asks for archived Sessions at all, which is what decides if the
// Archive is read.
export function showsArchived(status: SessionListStatus): boolean {
  return status !== 'active'
}

export function showsActive(status: SessionListStatus): boolean {
  return status !== 'archived'
}
