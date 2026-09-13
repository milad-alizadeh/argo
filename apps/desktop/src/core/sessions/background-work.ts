import { readDelegation } from './delegation'
import type { SessionRosterRow } from './models'

export function hasRunningBackgroundWork(session: SessionRosterRow): boolean {
  if (session.posture !== 'managed') return false
  const delegations = readDelegation(session.status, session.delegations)
  return (delegations.known && delegations.running.length > 0) || session.shell.length > 0
}
