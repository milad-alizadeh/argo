// The Tickets screen's one reading of state: the selected Project, its Connection, the Accounts and
// the Tickets, resolved into the single view the screen draws.
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { useAccounts } from '../../accounts/hooks/useAccounts'
import { useSelectedProject } from '../../projects/hooks/useSelectedProject'
import { useSettledQuery } from '../state/useTicketSearch'
import { useConnectForm } from './useConnectForm'
import {
  connectedView,
  failure,
  loading,
  type TicketsView,
  unconnectedView,
} from './useTicketsView-derive'

export type { TicketsView } from './useTicketsView-derive'

import { useConnection, useDisconnectSource, useTicketList } from './useTickets'
import { useUpdateStatus } from './useUpdateStatus'

export type TicketsScreenProps = { view: TicketsView }

export function useTicketsView(): TicketsScreenProps {
  const { t } = useTranslation('tickets')
  const project = useSelectedProject()
  const projectId = project?.id ?? null
  const accounts = useAccounts()
  const connection = useConnection(projectId)
  const query = useSettledQuery()
  const list = useTicketList(projectId, connection.data ?? null, query)
  const form = useConnectForm(projectId, accounts.data?.accounts, connection.data === null)
  const disconnectSource = useDisconnectSource()
  const updateStatus = useUpdateStatus()
  const { ticketKey } = useParams()
  const navigate = useNavigate()

  function view(): TicketsView {
    if (!project) return { kind: 'no-project' }
    if (connection.isPending) return loading(t('loading.connection'))
    if (connection.error) {
      return failure(t('failure.connection'), connection.error, {
        onRetry: connection.refetch,
        provider: null,
      })
    }
    if (connection.data === null) return unconnectedView(t, { project, accounts, form })
    const projectId = project.id
    return connectedView(t, {
      projectId,
      connection: connection.data,
      list,
      query,
      onDisconnectSource: () => disconnectSource.mutate({ projectId }),
      onChangeStatus: (key, status) => updateStatus.mutate({ projectId, key, status }),
      selectedKey: ticketKey ?? null,
      onSelect: (key) => navigate(`/tickets/${encodeURIComponent(key)}`),
      onOpenSession: (id) => navigate(`/sessions/${id}`),
    })
  }

  return { view: view() }
}
