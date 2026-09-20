import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import { readSubagentReading } from '@/domains/sessions/contract/subagents'

export function hasRunningBackgroundWork(session: SessionRosterRow): boolean {
  if (session.posture !== 'managed') return false
  const subagents = readSubagentReading(session.status, session.subagents)
  return (subagents.known && subagents.running.length > 0) || runningShell(session).length > 0
}

// A background Shell stays in the Shell list after it ends, so what is RUNNING is the state each row
// carries rather than the length of the list (#1582).
function runningShell(session: Pick<SessionRosterRow, 'shell'>) {
  return session.shell.filter((command) => command.state === 'running')
}
