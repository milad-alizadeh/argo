import { AccountsDialog } from '../../accounts/components/AccountsDialog'
import { TicketsRoom } from '../components/TicketsRoom'
import { useTicketsView } from '../hooks/useTicketsView'

export function TicketsPage() {
  return (
    <>
      <TicketsRoom {...useTicketsView()} />
      <AccountsDialog />
    </>
  )
}
