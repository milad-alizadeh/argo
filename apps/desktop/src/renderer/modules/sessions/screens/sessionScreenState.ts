import type { HarnessControl, SessionCli } from '../harness/harnesses'
import { isOptimisticSessionId } from '../state/useSessionCreationStore'
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
  // An optimistic row has not called `session.start` yet (#2109): the harness it starts under is
  // still the reader's to pick, the same as a Session that has no Roster row at all.
  const isPicking = selectedSessionId === null || isOptimisticSessionId(selectedSessionId)
  return isPicking ? { cli: lastHarness, onChange: chooseHarness } : { cli: sessionCliOf(session) }
}
