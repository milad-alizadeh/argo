// Every reason the Tickets screen cannot show a backlog, resolved into what the one problem state
// draws: an icon, a title, a sentence and the actions that can clear it.
import {
  CloudOff,
  EyeOff,
  HardDrive,
  Hourglass,
  KeyRound,
  LockKeyhole,
  type LucideIcon,
  TimerOff,
  TriangleAlert,
  Unplug,
} from 'lucide-react'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { ConnectionSummary, TicketErrorCode } from '@/domains/tickets/contract/contract'
import { i18n } from '../../../../platform/renderer/i18n/config'
import { contractText } from '../../../../platform/renderer/i18n/contract-text'
import type { ContractFailure } from '../../../../platform/renderer/lib/query-client'
import { providerPresentation } from '../../../accounts/renderer/lib/providers'

export type ProblemAction = { label: string; onClick: () => void; primary: boolean }

export type TicketProblemProps = {
  icon: LucideIcon
  title: string
  description: string
  // A failed read is announced; a Connection waiting on its Account is a state, not an event.
  alert: boolean
  actions: readonly ProblemAction[]
}

const FAILURE_ICONS: Partial<Record<TicketErrorCode, LucideIcon>> = {
  'github-unreachable': CloudOff,
  'linear-unreachable': CloudOff,
  'rate-limited': Hourglass,
  'linear-rate-limited': Hourglass,
  'account-expired': TimerOff,
  'account-revoked': KeyRound,
  'grant-unreadable': LockKeyhole,
  'missing-account': Unplug,
  'repository-not-visible': EyeOff,
  'team-not-visible': EyeOff,
  'storage-invalid': HardDrive,
  'storage-unavailable': HardDrive,
  'storage-not-written': HardDrive,
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
    icon: FAILURE_ICONS[error.code as TicketErrorCode] ?? TriangleAlert,
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

const CONNECTION_ICONS: Record<Problem, LucideIcon> = {
  'account-missing': Unplug,
  'account-expired': TimerOff,
  'account-revoked': KeyRound,
  'account-unreadable': LockKeyhole,
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
