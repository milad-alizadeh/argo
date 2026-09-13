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
  TriangleAlert,
  Unplug,
} from 'lucide-react'
import type { ConnectionSummary, TicketErrorCode } from '@/core/tickets/contract'
import type { ContractFailure } from '../../../lib/query-client'

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
  'rate-limited': Hourglass,
  'account-revoked': KeyRound,
  'grant-unreadable': LockKeyhole,
  'missing-account': Unplug,
  'repository-not-visible': EyeOff,
  'storage-invalid': HardDrive,
  'storage-unavailable': HardDrive,
  'storage-not-written': HardDrive,
}

// A failure the person can clear by signing in again offers that, beside reading again.
const RECONNECTABLE = new Set<string>(['account-revoked', 'grant-unreadable', 'missing-account'])

type Recovery = { onRetry: () => void; onReconnect: () => void }

export function failureProblem(
  title: string,
  error: ContractFailure,
  { onRetry, onReconnect }: Recovery,
): TicketProblemProps {
  const reconnectable = RECONNECTABLE.has(error.code)
  const retry = { label: 'Try again', onClick: onRetry, primary: !reconnectable }
  const reconnect = { label: 'Reconnect GitHub', onClick: onReconnect, primary: true }
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

// The Connection stays when its Account goes, so reconnecting the same identity brings it back.
const CONNECTION_PROBLEMS: Record<Problem, { icon: LucideIcon; title: (login: string) => string }> =
  {
    'account-missing': {
      icon: Unplug,
      title: () => 'The GitHub Account for this repository is disconnected',
    },
    'account-revoked': { icon: KeyRound, title: (login) => `GitHub no longer accepts ${login}` },
    'account-unreadable': {
      icon: LockKeyhole,
      title: (login) => `Argo cannot read the sign-in for ${login}`,
    },
  }

type ConnectionRecovery = { onReconnect: () => void; onDisconnectRepository: () => void }

export function connectionProblem(
  connection: TroubledConnection,
  { onReconnect, onDisconnectRepository }: ConnectionRecovery,
): TicketProblemProps {
  const { icon, title } = CONNECTION_PROBLEMS[connection.state]
  return {
    icon,
    title: title(connection.login ?? 'this Account'),
    description: `Reconnect it to read ${connection.scope} again.`,
    alert: false,
    actions: [
      { label: 'Reconnect GitHub', onClick: onReconnect, primary: true },
      { label: 'Disconnect repository', onClick: onDisconnectRepository, primary: false },
    ],
  }
}
