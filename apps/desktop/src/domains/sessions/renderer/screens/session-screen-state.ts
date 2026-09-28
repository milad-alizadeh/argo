import { type HarnessControl, type SessionHarness, sessionHarnessOf } from '../harness/harnesses'
import type { Session } from '../types'

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
  const isPicking = selectedSessionId === null
  return isPicking
    ? { harness: lastHarness, onChange: chooseHarness }
    : { harness: sessionHarnessOf(session) }
}
