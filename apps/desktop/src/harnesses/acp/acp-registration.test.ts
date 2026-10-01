import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import { writeMockClaudeAcp } from '@/mocks/cli/claude-acp/mock-claude-acp-cli'
import type { AcpAgentEntry } from './acp-agents'
import { acpExecutableOverride } from './acp-proof-protocol'
import { createAcpRegistration, createAcpRegistrations } from './acp-registration-factory'

let root: string
let executable: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'argo-acp-registration-'))
  executable = await writeMockClaudeAcp(root, path.join(root, 'transcripts'))
})

afterEach(async () => {
  delete process.env[acpExecutableOverride('claude-acp')]
  await rm(root, { recursive: true, force: true })
})

// A test agent is one entry, the same shape as a shipped one.
function mockAgent(env: Record<string, string> = {}): AcpAgentEntry<'claude-acp'> {
  return {
    id: 'claude-acp',
    label: 'Mock ACP',
    command: executable,
    args: [],
    installStep: 'Install the mock.',
    env,
  }
}

function start(
  prompt: string,
  turnConfiguration: SessionStartInput['turnConfiguration'] = {
    model: 'sonnet',
    effort: 'medium',
    mode: 'default',
  },
): SessionStartInput {
  return {
    harness: 'claude-acp',
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    cwd: root,
    commandId: 'command-1',
    prompt,
    attachments: [],
    turnConfiguration,
  }
}

function until(events: LiveSessionChannelEvent[], type: LiveSessionChannelEvent['type']) {
  return new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 10_000
    const check = () => {
      if (events.some((event) => event.type === type)) resolve()
      else if (Date.now() > deadline) reject(new Error(`No ${type} event arrived.`))
      else setTimeout(check, 10)
    }
    check()
  })
}

async function runTurn(
  registration: ReturnType<typeof createAcpRegistration>,
  input = start('hello'),
) {
  const events: LiveSessionChannelEvent[] = []
  const channel = registration.openLiveSession?.(input, undefined, (event) => {
    events.push(event)
  })
  await until(events, 'turn.completed')
  channel?.close()
  const identity = events.find((event) => event.type === 'identity')
  if (identity?.type !== 'identity') throw new Error('The channel named no Session.')
  return { events, nativeId: identity.nativeId }
}

describe('a shipped ACP agent entry', () => {
  test('starts the executable a proof names in place of the one on PATH', async () => {
    process.env[acpExecutableOverride('claude-acp')] = executable
    const catalog = await createAcpRegistrations()['claude-acp'].readCatalog()
    expect(catalog).toMatchObject({ harness: 'claude-acp', availability: 'available' })
  })

  test('reads missing when a proof names no executable', async () => {
    process.env[acpExecutableOverride('claude-acp')] = ''
    const registration = createAcpRegistrations()['claude-acp']
    expect(await registration.checkReadiness()).toEqual({
      harness: 'claude-acp',
      state: 'missing',
      detail: null,
    })
  })
})

describe('a shipped ACP agent entry without the agent installed', () => {
  const saved = { SHELL: process.env.SHELL, PATH: process.env.PATH }
  let bin: string

  beforeEach(async () => {
    bin = path.join(root, 'bin')
    await mkdir(bin)
    // With no login shell, the lookup reads PATH, which holds only this empty folder.
    process.env.SHELL = ''
    process.env.PATH = bin
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test('names the missing agent and the command that installs it', async () => {
    expect(await createAcpRegistrations()['claude-acp'].readCatalog()).toEqual({
      harness: 'claude-acp',
      availability: 'unavailable',
      reason: 'not-installed',
      installStep: expect.stringContaining('npm install -g @agentclientprotocol/claude-agent-acp'),
    })
  })

  test('finds the agent on the next read once it is installed', async () => {
    const registration = createAcpRegistrations()['claude-acp']
    expect(await registration.readCatalog()).toMatchObject({ reason: 'not-installed' })
    await writeMockClaudeAcp(bin, path.join(root, 'transcripts'))
    expect(await registration.readCatalog()).toMatchObject({ availability: 'available' })
  })
})

describe('the ACP catalog', () => {
  test('lists the model, effort and mode choices a fresh agent Session reports', async () => {
    const catalog = await createAcpRegistration(mockAgent()).readCatalog()
    expect(catalog).toMatchObject({
      harness: 'claude-acp',
      availability: 'available',
      label: 'Mock ACP',
      opening: { model: 'sonnet', effort: 'medium', mode: 'default' },
    })
    if (catalog.availability !== 'available') throw new Error('The catalog is unavailable.')
    expect(catalog.models.map(({ value }) => value)).toEqual(['sonnet', 'opus', 'haiku'])
    expect(catalog.modes.map(({ value, icon }) => [value, icon])).toContainEqual([
      'plan',
      'mode-plan',
    ])
  })

  test('hides only the control whose option it cannot read, and counts the rejection', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const catalog = await createAcpRegistration(
        mockAgent({ MOCK_ACP_UNREADABLE_OPTIONS: 'thought_level' }),
      ).readCatalog()
      if (catalog.availability !== 'available') throw new Error('The catalog is unavailable.')
      expect(catalog.efforts).toEqual([])
      expect(catalog.models.map(({ value }) => value)).toEqual(['sonnet', 'opus', 'haiku'])
      expect(catalog.modes.length).toBeGreaterThan(0)
      expect(warn).toHaveBeenCalledWith('Skipped 1 unreadable ACP Turn setting(s).')
    } finally {
      warn.mockRestore()
    }
  })

  test('stays available with no model choice when the agent reports none', async () => {
    const catalog = await createAcpRegistration(
      mockAgent({ MOCK_ACP_OMITTED_OPTIONS: 'model' }),
    ).readCatalog()
    expect(catalog).toMatchObject({ availability: 'available', models: [] })
  })
})

describe('an ACP agent that needs a login', () => {
  const needsLogin = { MOCK_ACP_NEEDS_LOGIN: '1' }

  test('reads signed out and lists itself as not signed in instead of failing', async () => {
    const registration = createAcpRegistration(mockAgent(needsLogin))
    expect(await registration.checkReadiness()).toEqual({
      harness: 'claude-acp',
      state: 'signed-out',
      detail: null,
    })
    expect(await registration.readCatalog()).toEqual({
      harness: 'claude-acp',
      availability: 'unavailable',
      reason: 'not-signed-in',
    })
  })

  const terminalLogin = {
    ...needsLogin,
    MOCK_ACP_LOGIN_METHOD: 'terminal',
    ANTHROPIC_API_KEY: 'key',
  }

  test('signs in by running the terminal method the agent offers, as claude-agent-acp does', async () => {
    const registration = createAcpRegistration({
      ...mockAgent(terminalLogin),
      unsetEnv: ['ANTHROPIC_API_KEY'],
    })
    expect(await registration.checkReadiness()).toMatchObject({ state: 'signed-out' })
    expect(await registration.signIn.login(new AbortController().signal)).toBe('completed')
    expect(await registration.checkReadiness()).toMatchObject({ state: 'ready' })
  })

  test('fails the sign-in when the terminal relaunch exits non-zero', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const registration = createAcpRegistration(mockAgent(terminalLogin))
      expect(await registration.signIn.login(new AbortController().signal)).toBe('failed')
      expect(await registration.checkReadiness()).toMatchObject({ state: 'signed-out' })
    } finally {
      warn.mockRestore()
    }
  })

  test('cancels a sign-in aborted before the agent answered', async () => {
    const registration = createAcpRegistration(mockAgent(terminalLogin))
    const controller = new AbortController()
    controller.abort()
    expect(await registration.signIn.login(controller.signal)).toBe('canceled')
  })

  test('signs in through the method the agent advertises, then reads ready', async () => {
    const registration = createAcpRegistration(mockAgent(needsLogin))
    expect(await registration.signIn.login(new AbortController().signal)).toBe('completed')
    expect(await registration.checkReadiness()).toMatchObject({ state: 'ready' })
    expect(await registration.readCatalog()).toMatchObject({ availability: 'available' })
  })
})

describe('an ACP agent without optional capabilities', () => {
  test('opens a Session with no history instead of failing when it cannot load one', async () => {
    const registration = createAcpRegistration(mockAgent({ MOCK_ACP_NO_LOAD_SESSION: '1' }))
    const { nativeId } = await runTurn(registration)
    expect(await registration.readHistory({ nativeId, subagentId: null, cwd: root })).toEqual([])
  })
})

describe('the ACP live channel', () => {
  test('streams a live reply and rereads the same Feed rows from vendor history', async () => {
    const registration = createAcpRegistration(mockAgent())
    const { events, nativeId } = await runTurn(registration)
    const live = new Map(
      events.flatMap((event) =>
        event.type === 'feed' && event.body.type === 'content'
          ? [[event.body.content.id, event.body.content] as const]
          : [],
      ),
    )
    const history = await registration.readHistory({ nativeId, subagentId: null, cwd: root })

    expect([...live.values()]).toEqual(history)
    expect(history).toEqual([
      { id: 'acp-prompt-1', kind: 'message', role: 'user', text: 'hello' },
      expect.objectContaining({ role: 'assistant', text: 'Mock Claude ACP read: hello' }),
    ])
    expect(events.map(({ type }) => type)).toEqual(
      expect.arrayContaining(['command.accepted', 'identity', 'turn.started', 'turn.completed']),
    )
  })

  test('skips the effort a chosen model stops reporting instead of failing the Turn', async () => {
    const { events } = await runTurn(
      createAcpRegistration(mockAgent()),
      start('hello', { model: 'haiku', effort: 'low', mode: 'plan' }),
    )
    expect(events.filter(({ type }) => type === 'failure')).toEqual([])
  })
})

describe('the ACP history targets', () => {
  test('refuses a Subagent history target, which ACP cannot address', async () => {
    await expect(
      createAcpRegistration(mockAgent()).readHistory({
        nativeId: 'root',
        subagentId: 'child',
        cwd: root,
      }),
    ).rejects.toThrow('Subagent')
  })

  test('refuses a history target with no working directory instead of guessing one', async () => {
    await expect(
      createAcpRegistration(mockAgent()).readHistory({
        nativeId: 'root',
        subagentId: null,
        cwd: null,
      }),
    ).rejects.toThrow('working directory')
  })
})
