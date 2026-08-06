import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type CommandResult, SESSION_SPAWN_CHANNEL } from '../shared'
import { handlers } from './__fixtures__/ipcChannels'
import type { AgentLauncher, Launched } from './agentLauncher'
import { createHub, type Hub } from './hub'
import { wireSpawn } from './spawnSession'

vi.mock('electron', async () => {
  const { handlers } = await import('./__fixtures__/ipcChannels')
  type Handler = Parameters<typeof handlers.set>[1]
  return {
    ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
  }
})

const FOLDER = '/Users/x/argo'
const SPAWNED_AT = Date.parse('2026-07-20T13:00:00.000Z')

const launcherThat = (launched: Launched): AgentLauncher => ({ start: () => launched })

function cockpit(launched: Launched): Hub {
  const hub = createHub()
  hub.apply({
    type: 'project-registered',
    project: { id: 'p-argo', name: 'argo', path: FOLDER },
  })
  wireSpawn(hub, launcherThat(launched), () => SPAWNED_AT)
  return hub
}

const spawn = (): CommandResult => handlers.get(SESSION_SPAWN_CHANNEL)?.() as CommandResult

beforeEach(() => handlers.clear())

describe('⌘N', () => {
  it('puts a row in the roster at spawn, with no transcript on disk', () => {
    const hub = cockpit({ ok: true, claim: 'claim-1' })

    spawn()

    expect(hub.getState().sessions).toEqual([
      expect.objectContaining({ id: 'claim-1', cwd: FOLDER, posture: 'managed' }),
    ])
  })

  it('attributes the row it publishes to the project it spawned in', () => {
    const hub = cockpit({ ok: true, claim: 'claim-1' })

    spawn()

    expect(hub.getState().sessions[0]?.projectId).toBe('p-argo')
  })

  it('says the CLI would not start in the tool’s own words', () => {
    cockpit({ ok: false, detail: 'spawn claude ENOENT' })

    expect(spawn()).toEqual({ ok: false, detail: 'spawn claude ENOENT' })
  })

  it('puts no row in the roster for a spawn that never happened', () => {
    const hub = cockpit({ ok: false, detail: 'spawn claude ENOENT' })

    spawn()

    expect(hub.getState().sessions).toEqual([])
  })

  it('refuses to spawn with no active project', () => {
    const hub = createHub()
    wireSpawn(hub, launcherThat({ ok: true, claim: 'claim-1' }), () => SPAWNED_AT)

    expect(spawn()).toEqual({ ok: false, detail: 'no active project' })
  })
})
