// Every reason the Tickets screen cannot show a backlog, resolved into what the one problem state
// draws: an icon, a title, a sentence and the actions that can clear it.
import type { Provider } from '@/domains/accounts/contract/contract'
import { providerPresentation } from '@/domains/accounts/renderer/port'
import type { ConnectionSummary, TicketErrorCode } from '@/domains/tickets/contract/contract'
import type { IconName } from '@/platform/renderer/components/icon/icon'
import { contractText } from '@/platform/renderer/i18n/contract-text'
import { i18n } from '@/platform/renderer/i18n/i18n'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'

export type ProblemAction = { label: string; onClick: () => void; primary: boolean }

export type TicketProblemProps = {
  icon: IconName
  title: string
  description: string
  // A failed read is announced; a Connection waiting on its Account is a state, not an event.
  alert: boolean
  actions: readonly ProblemAction[]
}

const FAILURE_ICONS: Partial<Record<TicketErrorCode, IconName>> = {
  'github-unreachable': 'connection-offline',
  'linear-unreachable': 'connection-offline',
  'rate-limited': 'rate-limited',
  'linear-rate-limited': 'rate-limited',
  'account-expired': 'account-expired',
  'account-revoked': 'account-revoked',
  'grant-unreadable': 'account-locked',
  'missing-account': 'account-disconnected',
  'repository-not-visible': 'not-visible',
  'team-not-visible': 'not-visible',
  'storage-invalid': 'storage-error',
  'storage-unavailable': 'storage-error',
  'storage-not-written': 'storage-error',
}

// A failure the person can clear by signing in again offers that, beside reading again.
const RECONNECTABLE = new Set<string>([
  'account-expired',
  'account-revoked',
  'grant-unreadable',
  'missing-account',
])

// Reconnecting opens the Accounts, named for the provider when the failure has one.
const reconnectLabel = (provider: Provider | null) =>
  provider
    ? i18n.t('tickets:problem.reconnect', { name: providerPresentation(provider).name })
    : i18n.t('tickets:problem.openAccounts')

export type Recovery = { onRetry: () => void; onReconnect: () => void; provider: Provider | null }

export function failureProblem(
  title: string,
  error: ContractFailure,
  { onRetry, onReconnect, provider }: Recovery,
): TicketProblemProps {
  const reconnectable = RECONNECTABLE.has(error.code)
  const retry = {
    label: i18n.t('tickets:problem.tryAgain'),
    onClick: onRetry,
    primary: !reconnectable,
  }
  const reconnect = { label: reconnectLabel(provider), onClick: onReconnect, primary: true }
  return {
    icon: FAILURE_ICONS[error.code as TicketErrorCode] ?? 'warning',
    title,
    description: contractText(error),
    alert: true,
    actions: reconnectable ? [retry, reconnect] : [retry],
  }
}

type Problem = Exclude<ConnectionSummary['state'], 'ready'>
export type TroubledConnection = ConnectionSummary & { state: Problem }

export const isConnectionProblem = (
  connection: ConnectionSummary,
): connection is TroubledConnection => connection.state !== 'ready'

type Named = { login: string; name: string; scope: string }

const CONNECTION_ICONS: Record<Problem, IconName> = {
  'account-missing': 'account-disconnected',
  'account-expired': 'account-expired',
  'account-revoked': 'account-revoked',
  'account-unreadable': 'account-locked',
}

// The Connection stays when its Account goes, so reconnecting the same identity brings it back.
// i18next ignores an interpolation value a key's text doesn't reference, so every state can pass
// the same full `named` regardless of which fields its own title actually uses.
function connectionTitle(state: Problem, named: Named): string {
  return i18n.t(`tickets:problem.connection.${state}.title`, named)
}

type ConnectionRecovery = { onReconnect: () => void; onDisconnectSource: () => void }

export function connectionProblem(
  connection: TroubledConnection,
  { onReconnect, onDisconnectSource }: ConnectionRecovery,
): TicketProblemProps {
  const { state } = connection
  const { name, scope } = providerPresentation(connection.provider)
  const named: Named = {
    login: connection.login ?? i18n.t('tickets:problem.noAccount'),
    name,
    scope: scope.one,
  }
  return {
    icon: CONNECTION_ICONS[state],
    title: connectionTitle(state, named),
    description: i18n.t('tickets:problem.reconnectDescription', { label: connection.label }),
    alert: false,
    actions: [
      { label: reconnectLabel(connection.provider), onClick: onReconnect, primary: true },
      {
        label: i18n.t('tickets:problem.disconnect', { scope: scope.one }),
        onClick: onDisconnectSource,
        primary: false,
      },
    ],
  }
}
