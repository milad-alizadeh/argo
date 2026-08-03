import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { aRoot, aTurn } from './__fixtures__/runtimeTree'
import { buildSessionInterior, DEFAULT_INTERIOR_UI } from './interiorModel'

const worked = aRoot({ turns: [aTurn({ id: 't' })] })

describe('buildSessionInterior', () => {
  it('opens on Activity — the live world, not the review surface', () => {
    const interior = buildSessionInterior({ session: sessionView({ id: 's' }) })
    expect(DEFAULT_INTERIOR_UI.tab).toBe('activity')
    expect(interior.tab).toBe('activity')
  })

  it('threads the room UI state onto the tab', () => {
    const interior = buildSessionInterior({
      session: sessionView({ id: 's' }),
      ui: { tab: 'delivery', jumpKey: null },
    })
    expect(interior.tab).toBe('delivery')
  })

  it('reads a session that has done nothing yet as fresh, so the Dock is home', () => {
    expect(
      buildSessionInterior({ session: sessionView({ id: 's', agents: [aRoot()] }) }).fresh,
    ).toBe(true)
  })

  it('leaves fresh behind on the first turn', () => {
    const interior = buildSessionInterior({ session: sessionView({ id: 's', agents: [worked] }) })
    expect(interior.fresh).toBe(false)
  })

  it('assembles the header, the Activity surface and the Dock from one session', () => {
    const session = sessionView({ id: 's', title: 'Auth refactor', posture: 'external' })
    const interior = buildSessionInterior({ session })
    expect(interior.header.title).toBe('Auth refactor')
    expect(interior.header.external).toBe(true)
    expect(interior.dock.kind).toBe('transcript')
    expect(interior.activity.items).toEqual([])
  })
})
