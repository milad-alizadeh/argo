import { describe, expect, it } from 'vitest'
import { argo, registered, replay, shop } from './__fixtures__/projection'

// Seam A for the two facts the connect panel owns (#265): the account-level GitHub grant, and
// each Project's Agent/CLI. Both are asserted through the same replay every other projection
// case uses, so main's copy and the renderer's are proved identical rather than assumed.

describe('the GitHub grant', () => {
  it('starts out never signed in', () => {
    expect(replay([]).projected.grant).toBe('none')
  })

  it('reads as connected once a sign-in completes', () => {
    const { hub, projected } = replay([{ type: 'grant-changed', grant: 'connected' }])
    expect(hub.grant).toBe('connected')
    expect(projected.grant).toBe('connected')
  })

  it('reads as needs-reconnect once the provider refuses the token', () => {
    const { projected } = replay([
      { type: 'grant-changed', grant: 'connected' },
      { type: 'grant-changed', grant: 'needs-reconnect' },
    ])
    expect(projected.grant).toBe('needs-reconnect')
  })

  it('broadcasts nothing when a poll re-confirms the grant it already held', () => {
    const { projected } = replay([{ type: 'grant-changed', grant: 'none' }])
    expect(projected.grant).toBe('none')
  })
})

describe("a Project's Agent/CLI", () => {
  it('spawns claude until someone chooses otherwise', () => {
    expect(replay([registered(argo)]).projected.projects[0]?.cli).toBe('claude')
  })

  it('carries the CLI Project Settings chose', () => {
    const { hub, projected } = replay([
      registered(argo),
      { type: 'project-cli-changed', id: argo.id, cli: 'codex' },
    ])
    expect(hub.projects[0]?.cli).toBe('codex')
    expect(projected.projects[0]?.cli).toBe('codex')
  })

  it('leaves every other Project on its own CLI', () => {
    const { projected } = replay([
      registered(argo),
      registered(shop),
      { type: 'project-cli-changed', id: argo.id, cli: 'codex' },
    ])
    expect(projected.projects.map((project) => project.cli)).toEqual(['codex', 'claude'])
  })

  it('ignores a CLI chosen for a Project the registry never recorded', () => {
    const { projected } = replay([
      registered(argo),
      { type: 'project-cli-changed', id: 'p-unknown', cli: 'codex' },
    ])
    expect(projected.projects.map((project) => project.cli)).toEqual(['claude'])
  })
})
