import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type CommandResult, SESSION_SPAWN_CHANNEL } from '../../shared'
import { createHub, type Hub } from '../hub'
import { handlers } from './__fixtures__/ipcChannels'
import type { AgentLauncher, Launched } from './agentLauncher'
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

/** A launcher that reports `launched`, and hands back the pty's own exit so a case can fire it. */
function launcherThat(launched: Launched): AgentLauncher & { exit: (code: number) => void } {
  let quit = (_code: number): void => {}
  return {
    start(_cwd, onExit) {
      if (launched.ok) quit = (code) => onExit?.(launched.claim, code)
      return launched
    },
    exit: (code) => quit(code),
  }
}

function cockpit(launched: Launched): { hub: Hub; agent: { exit: (code: number) => void } } {
  const hub = createHub()
  hub.apply({
    type: 'project-registered',
    project: { id: 'p-argo', name: 'argo', path: FOLDER },
  })
  const agent = launcherThat(launched)
  wireSpawn(hub, agent, () => SPAWNED_AT)
  return { hub, agent }
}

function spawn(): CommandResult {
  const pressed = handlers.get(SESSION_SPAWN_CHANNEL)
  if (pressed === undefined) throw new Error('⌘N reached no handler')
  return pressed()
}

beforeEach(() => handlers.clear())

describe('⌘N', () => {
  it('puts a row in the roster at spawn, with no transcript on disk', () => {
    const { hub } = cockpit({ ok: true, claim: 'claim-1' })

    spawn()

    expect(hub.getState().sessions).toEqual([
      expect.objectContaining({ id: 'claim-1', cwd: FOLDER, posture: 'managed' }),
    ])
  })

  it('attributes the row it publishes to the project it spawned in', () => {
    const { hub } = cockpit({ ok: true, claim: 'claim-1' })

    spawn()

    expect(hub.getState().sessions[0]?.projectId).toBe('p-argo')
  })

  it('says the CLI would not start in the tool’s own words', () => {
    cockpit({ ok: false, detail: 'spawn claude ENOENT' })

    expect(spawn()).toEqual({ ok: false, detail: 'spawn claude ENOENT' })
  })

  it('puts no row in the roster for a spawn that never happened', () => {
    const { hub } = cockpit({ ok: false, detail: 'spawn claude ENOENT' })

    spawn()

    expect(hub.getState().sessions).toEqual([])
  })

  it('refuses to spawn with no active project', () => {
    const hub = createHub()
    wireSpawn(hub, launcherThat({ ok: true, claim: 'claim-1' }), () => SPAWNED_AT)

    expect(spawn()).toEqual({ ok: false, detail: 'no active project' })
  })

  it('ends the row it published when that agent quits before writing a record', () => {
    // Nothing was observed, so no later sweep can correct this row: ownership died with the pty.
    const { hub, agent } = cockpit({ ok: true, claim: 'claim-1' })
    spawn()

    agent.exit(0)

    expect(hub.getState().sessions[0]).toMatchObject({
      posture: 'orphaned',
      facts: expect.objectContaining({ status: 'ended' }),
    })
  })

  it('says which way an agent went that died at startup', () => {
    // `claude` missing from the PATH does not throw on macOS — the child is forked and dies, so
    // this exit is the only account of it there is.
    const { hub, agent } = cockpit({ ok: true, claim: 'claim-1' })
    spawn()

    agent.exit(1)

    expect(hub.getState().sessions[0]?.title).toBe('claude exited (code 1)')
  })
})
