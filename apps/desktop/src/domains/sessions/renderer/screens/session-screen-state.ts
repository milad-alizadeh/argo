import type { HarnessControl, SessionHarness } from '../harness'
import { isOptimisticSessionId } from '../session-creation'
import type { Session } from '../types'

// Roster's open `harness` string narrows to the closed `SessionHarness` union at this adapter boundary (ADR-0021).
function sessionHarnessOf(session: Pick<Session, 'harness'> | null): SessionHarness {
  return session?.harness === 'codex' ? 'codex' : 'claude'
}

export function sessionHarness({
  selectedSessionId,
  lastHarness,
  chooseHarness,
  session,
}: {
  selectedSessionId: string | null
  lastHarness: SessionHarness
  chooseHarness: (harness: SessionHarness) => void
  session: Pick<Session, 'harness'> | null
}): HarnessControl {
  // An optimistic row has not called `session.start` yet (#2109): the harness it starts under is
  // still the reader's to pick, the same as a Session that has no Roster row at all.
  const isPicking = selectedSessionId === null || isOptimisticSessionId(selectedSessionId)
  return isPicking
    ? { harness: lastHarness, onChange: chooseHarness }
    : { harness: sessionHarnessOf(session) }
}
