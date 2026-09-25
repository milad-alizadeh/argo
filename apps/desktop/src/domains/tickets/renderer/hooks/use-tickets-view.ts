// The Tickets screen's one reading of state: the selected Project, its Connection, the Accounts and
// the Tickets, resolved into the single view the screen draws.
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { useAccounts } from '@/domains/accounts/renderer'
import { useSelectedProject } from '@/domains/projects/renderer'
import { useSettledQuery } from '../state/use-ticket-search'
import { useConnectForm } from './use-connect-form'
import {
  connectedView,
  failure,
  loading,
  type TicketsView,
  unconnectedView,
} from './use-tickets-view-derive'

export type { TicketsView } from './use-tickets-view-derive'

import { useConnection, useDisconnectSource, useTicketList } from './use-tickets'
import { useUpdatePriority } from './use-update-priority'
import { useUpdateStatus } from './use-update-status'

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
  const updatePriority = useUpdatePriority()
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
      onChangePriority: (key, priority) => updatePriority.mutate({ projectId, key, priority }),
      selectedKey: ticketKey ?? null,
      now: Date.now(),
      onBack: () => navigate('/tickets'),
      onSelect: (key) => navigate(`/tickets/${encodeURIComponent(key)}`),
      onOpenSession: (id) => navigate(`/sessions/${id}`),
    })
  }

  return { view: view() }
}
