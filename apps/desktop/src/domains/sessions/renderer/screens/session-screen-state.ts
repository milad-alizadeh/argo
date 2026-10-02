import { type Harness, harnessOrDefault } from '@/harnesses/harness'
import type { HarnessControl } from '../harness'
import type { Session } from '../types'

export function sessionHarness({
  selectedSessionId,
  lastHarness,
  chooseHarness,
  session,
  startedHarness,
}: {
  selectedSessionId: string | null
  lastHarness: Harness
  chooseHarness: (harness: Harness) => void
  session: Pick<Session, 'harness'> | null
  // The Harness picked at Send for the selected Session, which this screen just started.
  startedHarness: Harness | null
}): HarnessControl {
  // An optimistic row has not called `session.start` yet (#2109): the harness it starts under is
  // still the reader's to pick, the same as a Session that has no Roster row at all.
  if (selectedSessionId === null) return { harness: lastHarness, onChange: chooseHarness }
  // Its details have not loaded yet, so they cannot name its Harness (#3171).
  if (session === null && startedHarness !== null) return { harness: startedHarness }
  return { harness: harnessOrDefault(session?.harness) }
}
