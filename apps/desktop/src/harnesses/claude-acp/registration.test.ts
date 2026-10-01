import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import { writeMockClaudeAcp } from '../../../mocks/cli/claude-acp/mock-claude-acp-cli'
import { SESSION_CLAUDE_ACP_EXECUTABLE_ENV } from './proof-protocol'
import { createClaudeAcpRegistration } from './registration'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-acp-'))
  process.env[SESSION_CLAUDE_ACP_EXECUTABLE_ENV] = await writeMockClaudeAcp(
    root,
    path.join(root, 'transcripts'),
  )
})

afterEach(async () => {
  delete process.env[SESSION_CLAUDE_ACP_EXECUTABLE_ENV]
  await rm(root, { recursive: true, force: true })
})

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

describe('the Claude ACP registration', () => {
  test('lists the model, effort and mode choices a fresh agent Session reports', async () => {
    const catalog = await createClaudeAcpRegistration().readCatalog()
    expect(catalog).toMatchObject({
      harness: 'claude-acp',
      availability: 'available',
      opening: { model: 'sonnet', effort: 'medium', mode: 'default' },
    })
    if (catalog.availability !== 'available') throw new Error('The catalog is unavailable.')
    expect(catalog.models.map(({ value }) => value)).toEqual(['sonnet', 'opus', 'haiku'])
    expect(catalog.modes.map(({ value, icon }) => [value, icon])).toContainEqual([
      'plan',
      'mode-plan',
    ])
  })

  test('streams a live reply and rereads the same Feed rows from vendor history', async () => {
    const registration = createClaudeAcpRegistration()
    const events: LiveSessionChannelEvent[] = []
    const channel = registration.openLiveSession?.(start('hello'), undefined, (event) => {
      events.push(event)
    })
    await until(events, 'turn.completed')
    channel?.close()

    const identity = events.find((event) => event.type === 'identity')
    if (identity?.type !== 'identity') throw new Error('The channel named no Session.')
    const live = new Map(
      events.flatMap((event) =>
        event.type === 'feed' && event.body.type === 'content'
          ? [[event.body.content.id, event.body.content] as const]
          : [],
      ),
    )
    const history = await registration.readHistory({
      nativeId: identity.nativeId,
      subagentId: null,
      cwd: root,
    })

    expect([...live.values()]).toEqual(history)
    expect(history).toEqual([
      { id: 'acp-prompt-1', kind: 'message', role: 'user', text: 'hello' },
      expect.objectContaining({ role: 'assistant', text: 'Mock Claude ACP read: hello' }),
    ])
    expect(events.map(({ type }) => type)).toEqual(
      expect.arrayContaining(['command.accepted', 'identity', 'turn.started', 'turn.completed']),
    )
  })
})

describe('the Claude ACP catalog without the agent installed', () => {
  const saved = { SHELL: process.env.SHELL, PATH: process.env.PATH }
  let bin: string

  beforeEach(async () => {
    delete process.env[SESSION_CLAUDE_ACP_EXECUTABLE_ENV]
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
    expect(await createClaudeAcpRegistration().readCatalog()).toEqual({
      harness: 'claude-acp',
      availability: 'unavailable',
      reason: 'not-installed',
      installStep: expect.stringContaining('npm install -g @agentclientprotocol/claude-agent-acp'),
    })
  })

  test('finds the agent on the next read once it is installed', async () => {
    const registration = createClaudeAcpRegistration()
    expect(await registration.readCatalog()).toMatchObject({ reason: 'not-installed' })
    await writeMockClaudeAcp(bin, path.join(root, 'transcripts'))
    expect(await registration.readCatalog()).toMatchObject({ availability: 'available' })
  })
})

describe('the Claude ACP history targets', () => {
  test('refuses a Subagent history target, which ACP cannot address', async () => {
    await expect(
      createClaudeAcpRegistration().readHistory({
        nativeId: 'root',
        subagentId: 'child',
        cwd: root,
      }),
    ).rejects.toThrow('Subagent')
  })

  test('refuses a history target with no working directory instead of guessing one', async () => {
    await expect(
      createClaudeAcpRegistration().readHistory({ nativeId: 'root', subagentId: null, cwd: null }),
    ).rejects.toThrow('working directory')
  })
})

describe('the Claude ACP live channel', () => {
  test('skips the effort a chosen model stops reporting instead of failing the Turn', async () => {
    const events: LiveSessionChannelEvent[] = []
    const channel = createClaudeAcpRegistration().openLiveSession?.(
      start('hello', { model: 'haiku', effort: 'low', mode: 'plan' }),
      undefined,
      (event) => {
        events.push(event)
      },
    )
    await until(events, 'turn.completed')
    channel?.close()
    expect(events.filter(({ type }) => type === 'failure')).toEqual([])
  })
})
