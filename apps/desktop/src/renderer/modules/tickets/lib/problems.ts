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
import type { Provider } from '@/core/accounts/contract'
import type { ConnectionSummary, TicketErrorCode } from '@/core/tickets/contract'
import type { ContractFailure } from '../../../lib/query-client'
import { PROVIDER_PRESENTATION } from '../../accounts/lib/providers'

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
  provider ? `Reconnect ${PROVIDER_PRESENTATION[provider].name}` : 'Open Accounts'

export type Recovery = { onRetry: () => void; onReconnect: () => void; provider: Provider | null }

export function failureProblem(
  title: string,
  error: ContractFailure,
  { onRetry, onReconnect, provider }: Recovery,
): TicketProblemProps {
  const reconnectable = RECONNECTABLE.has(error.code)
  const retry = { label: 'Try again', onClick: onRetry, primary: !reconnectable }
  const reconnect = { label: reconnectLabel(provider), onClick: onReconnect, primary: true }
  return {
    icon: FAILURE_ICONS[error.code as TicketErrorCode] ?? TriangleAlert,
    title,
    description: error.message,
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

// The Connection stays when its Account goes, so reconnecting the same identity brings it back.
const CONNECTION_PROBLEMS: Record<Problem, { icon: LucideIcon; title: (named: Named) => string }> =
  {
    'account-missing': {
      icon: Unplug,
      title: ({ name, scope }) => `The ${name} Account for this ${scope} is disconnected`,
    },
    'account-expired': {
      icon: TimerOff,
      title: ({ login }) => `The sign-in for ${login} expired`,
    },
    'account-revoked': {
      icon: KeyRound,
      title: ({ login, name }) => `${name} no longer accepts ${login}`,
    },
    'account-unreadable': {
      icon: LockKeyhole,
      title: ({ login }) => `Argo cannot read the sign-in for ${login}`,
    },
  }

type ConnectionRecovery = { onReconnect: () => void; onDisconnectSource: () => void }

export function connectionProblem(
  connection: TroubledConnection,
  { onReconnect, onDisconnectSource }: ConnectionRecovery,
): TicketProblemProps {
  const { icon, title } = CONNECTION_PROBLEMS[connection.state]
  const { name, scope } = PROVIDER_PRESENTATION[connection.provider]
  return {
    icon,
    title: title({ login: connection.login ?? 'this Account', name, scope: scope.one }),
    description: `Reconnect it to read ${connection.label} again.`,
    alert: false,
    actions: [
      { label: reconnectLabel(connection.provider), onClick: onReconnect, primary: true },
      { label: `Disconnect ${scope.one}`, onClick: onDisconnectSource, primary: false },
    ],
  }
}
