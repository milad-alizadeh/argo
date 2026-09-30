import { useSearchParams } from 'react-router'
import type { SessionListInput } from '../session-list-query'

export type SessionListFilter = SessionListInput['filter']

// Which Sessions the list shows, held in the URL's `status` parameter.
export function useSessionListFilter() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status')
  const filter: SessionListFilter = status === 'archived' || status === 'all' ? status : 'active'
  const setFilter = (next: SessionListFilter) =>
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (next === 'active') updated.delete('status')
      else updated.set('status', next)
      return updated
    })
  return [filter, setFilter] as const
}
