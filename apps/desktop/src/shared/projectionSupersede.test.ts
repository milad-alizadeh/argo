import { describe, expect, it } from 'vitest'
import { created, replay, session } from './__fixtures__/projection'
import type { HubEvent, SessionIntake } from './index'

// The row ⌘N publishes for an agent Argo has just started stands under the claim's own id, because
// the CLI picks a Session id only when it writes its first record (#361). This is the moment the
// two meet: one agent must leave one row behind, whichever order the events arrive in.

const superseded = (over: Partial<SessionIntake>, provisionalId: string): HubEvent => ({
  type: 'session-superseded',
  session: session(over),
  provisionalId,
})

describe('the row a spawn published', () => {
  it('gives way to the Session the CLI named, rather than standing beside it', () => {
    const { projected } = replay([
      created({ id: 'claim-1', title: 'New session' }),
      superseded({ id: 's1' }, 'claim-1'),
    ])
    expect(projected.sessions.map((row) => row.id)).toEqual(['s1'])
  })

  it('hands the Session that replaces it its place in the roster', () => {
    const { projected } = replay([
      created({ id: 'first' }),
      created({ id: 'claim-1' }),
      created({ id: 'last' }),
      superseded({ id: 's1' }, 'claim-1'),
    ])
    expect(projected.sessions.map((row) => row.id)).toEqual(['first', 's1', 'last'])
  })

  it('is no condition of the Session arriving: an agent Argo adopted has no row to replace', () => {
    const { projected } = replay([superseded({ id: 's1' }, 'claim-9')])
    expect(projected.sessions.map((row) => row.id)).toEqual(['s1'])
  })

  it('reaches the renderer as one delta, so the roster never holds both', () => {
    const { hub, projected } = replay([
      created({ id: 'claim-1' }),
      superseded({ id: 's1', cwd: '/Users/dev/code/argo' }, 'claim-1'),
    ])
    expect(projected).toEqual(hub)
  })
})
