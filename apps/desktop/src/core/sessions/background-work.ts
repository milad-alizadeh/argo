import { readDelegation } from './delegation'
import type { SessionRosterRow } from './models'

export function hasRunningBackgroundWork(session: SessionRosterRow): boolean {
  if (session.posture !== 'managed') return false
  const delegations = readDelegation(session.status, session.delegations)
  return (delegations.known && delegations.running.length > 0) || runningShell(session).length > 0
}

// A background Shell stays on the rail after it ends, so what is RUNNING is the state each row
// carries rather than the length of the list (#1582).
function runningShell(session: Pick<SessionRosterRow, 'shell'>) {
  return session.shell.filter((command) => command.state === 'running')
}
