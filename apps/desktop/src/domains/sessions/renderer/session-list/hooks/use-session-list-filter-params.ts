import { useSearchParams } from 'react-router'
import type { SessionListInput } from '../session-list-query'

type SessionListFilter = SessionListInput['filter']

// Which Sessions the list shows, held in the URL's `status` parameter.
export function useSessionListStatus(): SessionListFilter {
  const [params] = useSearchParams()
  const status = params.get('status')
  return status === 'archived' || status === 'all' ? status : 'active'
}

export function useSetSessionListStatus(): (status: SessionListFilter) => void {
  const [, setParams] = useSearchParams()
  return (status) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (status === 'active') next.delete('status')
      else next.set('status', status)
      return next
    })
}
