import { describe, expect, it } from 'vitest'
import {
  FIXTURE_DEVICE as DEVICE,
  FIXTURE_FOLDER as FOLDER,
  connectPanel as panel,
} from './__fixtures__/connectPanel'
import type { ConnectPanelInput, ConnectState } from './connectPanelModel'

// The connect panel's whole derivation (#265): which of the seven states the panel is in, and
// which rows read as done. Onboarding IS creating a Project (ADR-0015), so the same model
// answers for a Project being created and for Project Settings re-opened on one that exists.

const state = (over: Partial<ConnectPanelInput> = {}): ConnectState => panel(over).state

describe('which state the panel is in', () => {
  it.each([
    ['nothing asked for yet', { welcoming: true }, 'welcome'],
    ['the panel with nothing set', {}, 'fresh'],
    ['a folder and nothing else', { folder: FOLDER }, 'direct'],
    ['a sign-in waiting on the browser', { device: DEVICE }, 'connecting'],
    ['a folder plus a signed-in provider', { folder: FOLDER, grant: 'connected' }, 'partial'],
    [
      'all three rows in place',
      { folder: FOLDER, grant: 'connected', plugin: 'installed' },
      'wired',
    ],
    ['a grant the provider refused', { grant: 'needs-reconnect' }, 'error'],
  ] as [string, Partial<ConnectPanelInput>, ConnectState][])(
    'reads %s as %s',
    (_case, input, expected) => {
      expect(state(input)).toBe(expected)
    },
  )

  it('shows the refused grant over everything else that is set', () => {
    // The panel is also the reconnect surface, so a revoked grant is what a fully-set-up
    // project has to be told about before anything else it could show.
    expect(state({ folder: FOLDER, plugin: 'installed', grant: 'needs-reconnect' })).toBe('error')
  })

  it('shows the device code over the tally, so a user mid-sign-in still gets it', () => {
    expect(state({ folder: FOLDER, device: DEVICE })).toBe('connecting')
  })

  it('stays on welcome even once a folder is set, because welcome is a screen', () => {
    expect(state({ welcoming: true, folder: FOLDER })).toBe('welcome')
  })

  it('reads a signed-in provider with no folder as partly set up, not as the floor', () => {
    expect(state({ grant: 'connected' })).toBe('partial')
  })
})

describe('the call to action', () => {
  it('offers to create the project the moment a folder is set', () => {
    expect(panel({ folder: FOLDER }).cta).toEqual({ label: 'Create project', enabled: true })
  })

  it('refuses to create a project with no folder to create it from', () => {
    expect(panel().cta.enabled).toBe(false)
  })

  it('never asks for a provider before it will create the project', () => {
    // Git and a provider unlock the backlog and PRs; they never gate entry (#165).
    expect(panel({ folder: FOLDER, grant: 'none' }).cta.enabled).toBe(true)
  })

  it('reads Done when the panel is Project Settings re-opened', () => {
    expect(panel({ mode: 'settings', folder: FOLDER }).cta.label).toBe('Done')
  })

  it.each([
    ['settings', 'Project settings'],
    ['onboarding', 'Set up your project'],
  ] as [ConnectPanelInput['mode'], string][])('names itself %s as "%s"', (mode, title) => {
    expect(panel({ mode }).title).toBe(title)
  })

  it('lets Project Settings close even while a row is still an offer', () => {
    expect(panel({ mode: 'settings', folder: FOLDER, grant: 'none' }).cta.enabled).toBe(true)
  })
})

describe('the three rows', () => {
  it('offers all three whatever is set, so none of them blocks another', () => {
    expect(panel().rows.map((row) => row.key)).toEqual(['folder', 'connections', 'plugin'])
  })

  it('completes the folder row on the folder alone', () => {
    const rows = panel({ folder: FOLDER }).rows
    expect(rows.map((row) => row.done)).toEqual([true, false, false])
  })

  it('completes the provider row without a folder, so the order is the user’s', () => {
    const rows = panel({ grant: 'connected' }).rows
    expect(rows.map((row) => row.done)).toEqual([false, true, false])
  })

  it('shows the chosen folder rather than a placeholder for it', () => {
    expect(panel({ folder: FOLDER }).rows[0]?.value).toBe(FOLDER)
  })

  it('offers to reconnect on the row whose grant was refused', () => {
    expect(panel({ grant: 'needs-reconnect' }).rows[1]?.action).toBe('Reconnect')
  })

  it('reports the folder without offering to re-pick it in Project Settings', () => {
    // Re-pointing an existing Project is a relocate, which the failure policy owns; a
    // `Choose folder` button here would look like one and do nothing.
    expect(panel({ mode: 'settings', folder: FOLDER }).rows[0]).toMatchObject({
      value: FOLDER,
      action: null,
    })
  })

  it('offers no companion-plugin action while Argo has no plugin to install', () => {
    expect(panel().rows[2]).toMatchObject({ action: null, value: 'Not available yet' })
  })

  it('names no honesty tier anywhere in its copy', () => {
    // The tier ladder was cut in favour of plain benefit copy (#165): each row says what the
    // user gets, never which provenance rung it lights up.
    const copy = panel({ folder: FOLDER, grant: 'connected' })
      .rows.flatMap((row) => [row.title, row.benefit, row.value ?? '', row.action ?? ''])
      .join(' ')
      .toLowerCase()
    for (const tier of ['direct', 'derived', 'convention']) expect(copy).not.toContain(tier)
  })

  it('carries no em dash in any line the user reads', () => {
    const copy = panel({ folder: FOLDER }).rows.flatMap((row) => [
      row.title,
      row.benefit,
      row.value ?? '',
      row.action ?? '',
    ])
    for (const line of copy) expect(line).not.toContain('—')
  })
})

describe('the Agent/CLI row', () => {
  it('is carried only where there is a Project to set it on', () => {
    expect(panel({ mode: 'settings', folder: FOLDER, cli: 'codex' }).cli).toBe('codex')
  })

  it('is absent while onboarding, so ⌘N has nothing to ask about', () => {
    expect(panel({ mode: 'onboarding', cli: 'codex' }).cli).toBeNull()
  })
})
