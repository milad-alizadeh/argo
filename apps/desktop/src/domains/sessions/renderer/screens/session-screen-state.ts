import { type Harness, harnessOrDefault } from '@/harnesses/harness'
import type { TurnConfiguration } from '../composer'
import type { HarnessControl } from '../harness'
import type { Session } from '../types'

// The Harness and Turn configuration a new Session's Send used, which stand in until its details load.
export type SentConfiguration = { harness: Harness; turnConfiguration: TurnConfiguration }

export function sessionHarness({
  selectedSessionId,
  lastHarness,
  chooseHarness,
  session,
  sent,
}: {
  selectedSessionId: string | null
  lastHarness: Harness
  chooseHarness: (harness: Harness) => void
  session: Pick<Session, 'harness'> | null
  sent: SentConfiguration | null
}): HarnessControl | null {
  // An optimistic row has not called `session.start` yet (#2109): the harness it starts under is
  // still the reader's to pick, the same as a Session that has no Roster row at all.
  if (selectedSessionId === null) return { harness: lastHarness, onChange: chooseHarness }
  if (session !== null) return { harness: harnessOrDefault(session.harness) }
  // An open Session shows no Harness until its details name one (#3171, #3172), unless this
  // window's Send started it under a known Harness (#3179).
  return sent === null ? null : { harness: sent.harness }
}
