import { type Harness, harnessOrDefault } from '@/harnesses/harness'
import type { HarnessControl } from '../harness'
import type { Session } from '../types'

export function sessionHarness({
  selectedSessionId,
  lastHarness,
  chooseHarness,
  session,
}: {
  selectedSessionId: string | null
  lastHarness: Harness
  chooseHarness: (harness: Harness) => void
  session: Pick<Session, 'harness'> | null
}): HarnessControl | null {
  // An optimistic row has not called `session.start` yet (#2109): the harness it starts under is
  // still the reader's to pick, the same as a Session that has no Roster row at all.
  if (selectedSessionId === null) return { harness: lastHarness, onChange: chooseHarness }
  // An open Session shows no Harness until its details name one (#3171, #3172).
  return session === null ? null : { harness: harnessOrDefault(session.harness) }
}
