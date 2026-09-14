import type { HarnessControl, SessionCli } from '../harness/harnesses'
import type { Session } from '../types'

// Roster's open `cli` string narrows to the closed `SessionCli` union at this adapter boundary (ADR-0021).
function sessionCliOf(session: Pick<Session, 'cli'> | null): SessionCli {
  return session?.cli === 'codex' ? 'codex' : 'claude'
}

export function sessionHarness({
  selectedSessionId,
  lastHarness,
  chooseHarness,
  session,
}: {
  selectedSessionId: string | null
  lastHarness: SessionCli
  chooseHarness: (cli: SessionCli) => void
  session: Pick<Session, 'cli'> | null
}): HarnessControl {
  return selectedSessionId === null
    ? { cli: lastHarness, onChange: chooseHarness }
    : { cli: sessionCliOf(session) }
}

export function sessionHasWork(session: Pick<Session, 'delegations' | 'shell'> | null) {
  return session !== null && (session.delegations.length > 0 || session.shell.length > 0)
}

// What opens a collapsed inspector on its own: a Subagent, or a Shell the CLI put in the
// background. A foreground command is already in the Feed, so it opens nothing (#1582).
export function sessionHasBackgroundWork(session: Pick<Session, 'delegations' | 'shell'> | null) {
  return (
    session !== null &&
    (session.delegations.length > 0 || session.shell.some((command) => command.background))
  )
}
