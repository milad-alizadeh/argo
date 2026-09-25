import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

const ACCOUNTS_PARAMETER = 'accounts'

export function useAccountsDialog() {
  const [search, setSearch] = useSearchParams()
  const setOpen = useCallback(
    (open: boolean) => {
      setSearch(
        (current) => {
          const next = new URLSearchParams(current)
          if (open) next.set(ACCOUNTS_PARAMETER, '1')
          else next.delete(ACCOUNTS_PARAMETER)
          return next
        },
        { replace: true },
      )
    },
    [setSearch],
  )
  return { open: search.get(ACCOUNTS_PARAMETER) === '1', setOpen }
}

export function useOpenAccountsDialog() {
  const { setOpen } = useAccountsDialog()
  return useCallback(() => setOpen(true), [setOpen])
}
