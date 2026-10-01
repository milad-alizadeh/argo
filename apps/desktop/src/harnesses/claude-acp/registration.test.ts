import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import { connectAcpAgent } from '@/harnesses/acp/acp-client'
import type { LiveSessionChannelEvent, LiveSessionControls } from '@/harnesses/registration'
import recorded from '../../../mocks/cli/claude-acp/fixtures/session-discovery-0.84.0.json'
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
  test('counts malformed vendor summaries and keeps the valid records', async () => {
    const valid = recorded.listing.result.sessions[0]
    if (valid === undefined) throw new Error('The recorded ACP listing has no Session.')
    await writeFile(
      path.join(root, 'mock-acp-options.json'),
      JSON.stringify({
        listing: {
          sessions: [valid, { ...valid, cwd: 'relative' }, { ...valid, updatedAt: 'yesterday' }],
        },
      }),
    )
    const listing = await createClaudeAcpRegistration().listSessionSummaries({
      knownNativeIds: [valid.sessionId],
    })
    expect(listing.skipped).toBe(2)
    expect(listing.records).toHaveLength(1)
  })

  test('reports a repeated pagination cursor instead of accepting an incomplete scan', async () => {
    await writeMockClaudeAcp(root, path.join(root, 'transcripts'), {
      listing: { ...recorded.listing.result, nextCursor: 'repeated' },
    })
    await expect(
      createClaudeAcpRegistration().listSessionSummaries({ knownNativeIds: ['missing-saved'] }),
    ).rejects.toThrow('repeated a cursor')
  })
})

describe('the Claude ACP recorded discovery', () => {
  test('reads the real producer listing and keeps its title as a preview', async () => {
    await writeMockClaudeAcp(root, path.join(root, 'transcripts'), {
      listing: recorded.listing.result,
    })
    expect(
      await createClaudeAcpRegistration().listSessionSummaries({
        knownNativeIds: ['11111111-2222-4333-8444-555555555555'],
      }),
    ).toEqual({
      skipped: 0,
      records: [
        {
          nativeId: '11111111-2222-4333-8444-555555555555',
          cwd: '/tmp/argo-acp-protocol-project',
          preview: 'Recorded ACP discovery',
          activityAt: 1790827505390,
        },
      ],
    })
  })

  test('keeps saved Sessions when listing is unsupported', async () => {
    await writeMockClaudeAcp(root, path.join(root, 'transcripts'), {
      capabilities: { loadSession: true },
    })
    const registration = createClaudeAcpRegistration()
    expect(await registration.listSessionSummaries({ knownNativeIds: ['saved'] })).toEqual({
      records: [],
      skipped: 0,
    })
    expect(await registration.getSessionSummary('saved')).toBeNull()
  })
})

describe('the Claude ACP saved discovery', () => {
  test('refreshes saved Sessions across pages without importing external conversations', async () => {
    const executable = process.env[SESSION_CLAUDE_ACP_EXECUTABLE_ENV]
    if (executable === undefined) throw new Error('No mock executable.')
    const client = await connectAcpAgent(
      { executable, args: [], env: process.env },
      {
        update: () => {},
        requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
      },
    )
    const first = await client.newSession(root)
    const second = await client.newSession(root)
    const external = await client.newSession(root)
    await client.prompt(first.sessionId, 'Saved first')
    await client.prompt(second.sessionId, 'Saved second')
    await client.prompt(external.sessionId, 'Outside Argo')
    client.close()
    const registration = createClaudeAcpRegistration()
    const listing = await registration.listSessionSummaries({
      knownNativeIds: [first.sessionId, second.sessionId],
    })
    expect(listing.skipped).toBe(0)
    expect(listing.records).toHaveLength(2)
    expect(await registration.listSessionSummaries({ knownNativeIds: [] })).toEqual({
      records: [],
      skipped: 0,
    })
    expect(listing.records).toEqual(
      expect.arrayContaining([
        { nativeId: first.sessionId, cwd: root, preview: 'Saved first' },
        { nativeId: second.sessionId, cwd: root, preview: 'Saved second' },
      ]),
    )
    expect(await registration.getSessionSummary(second.sessionId)).toEqual({
      nativeId: second.sessionId,
      cwd: root,
      preview: 'External second',
    })
  })
})

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
    await until(events, 'closed')

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
  test('resumes by loading history and keeps prompt identities after a process restart', async () => {
    const registration = createClaudeAcpRegistration()
    const first: LiveSessionChannelEvent[] = []
    const initial = registration.openLiveSession?.(start('before restart'), undefined, (event) =>
      first.push(event),
    )
    await until(first, 'turn.completed')
    initial?.close()
    await until(first, 'closed')
    const identity = first.find((event) => event.type === 'identity')
    if (identity?.type !== 'identity') throw new Error('No native identity.')
    const later: LiveSessionChannelEvent[] = []
    const resumed = registration.openLiveSession?.(
      {
        ...start('after restart'),
        commandId: 'command-2',
        sessionId: 'argo-saved',
        resume: {
          harness: 'claude-acp',
          nativeId: identity.nativeId,
          cwd: root,
          projectId: 'project-1',
          workspaceId: 'workspace-1',
        },
      },
      undefined,
      (event) => later.push(event),
    )
    await until(later, 'turn.completed')
    resumed?.close()
    await until(later, 'closed')
    const history = await registration.readHistory({
      nativeId: identity.nativeId,
      cwd: root,
      subagentId: null,
    })
    expect(history.filter((row) => row.kind === 'message' && row.role === 'user')).toEqual([
      { id: 'acp-prompt-1', kind: 'message', role: 'user', text: 'before restart' },
      { id: 'acp-prompt-2', kind: 'message', role: 'user', text: 'after restart' },
    ])
    expect(later).toContainEqual(
      expect.objectContaining({
        type: 'feed',
        body: expect.objectContaining({
          type: 'content',
          content: { id: 'acp-prompt-2', kind: 'message', role: 'user', text: 'after restart' },
        }),
      }),
    )
  })
})

describe('the Claude ACP interruptions', () => {
  test('cancels a Permission without reader-supported answers before offering it', async () => {
    await writeMockClaudeAcp(root, path.join(root, 'transcripts'), {
      permissionOptions: [
        { optionId: 'reject-always', name: 'Always deny', kind: 'reject_always' },
      ],
    })
    const events: LiveSessionChannelEvent[] = []
    let offered = false
    const controls: LiveSessionControls = {
      requestPermission: async () => {
        offered = true
        return 'cancel'
      },
      requestQuestion: async () => [],
      decidePermission: () => false,
      decideQuestion: () => false,
    }
    const channel = createClaudeAcpRegistration().openLiveSession?.(
      start('Request ACP permission'),
      controls,
      (event) => events.push(event),
    )
    await until(events, 'turn.completed')
    expect(offered).toBe(false)
    expect(events.some((event) => event.type === 'feed' && event.body.type === 'permission')).toBe(
      false,
    )
    channel?.close()
    await until(events, 'closed')
  })
})

describe('the Claude ACP interruptions', () => {
  test('interrupts a pending permission and refuses unsupported Question answers', async () => {
    const events: LiveSessionChannelEvent[] = []
    let pendingSignal: AbortSignal | undefined
    const controls: LiveSessionControls = {
      requestPermission: ({ signal }) =>
        new Promise((_resolve, reject) => {
          pendingSignal = signal
          signal.addEventListener('abort', () => reject(new Error('Interrupted')), { once: true })
        }),
      requestQuestion: async () => {
        throw new Error('ACP offered an unsupported Question.')
      },
      decidePermission: () => false,
      decideQuestion: () => false,
    }
    const channel = createClaudeAcpRegistration().openLiveSession?.(
      start('Request ACP permission'),
      controls,
      (event) => events.push(event),
    )
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 5_000
      const check = () => {
        if (pendingSignal !== undefined) resolve()
        else if (Date.now() > deadline) reject(new Error('No Permission arrived.'))
        else setTimeout(check, 10)
      }
      check()
    })
    expect(await channel?.answerQuestion('unsupported', [])).toBe(false)
    await channel?.interrupt()
    await until(events, 'turn.completed')
    expect(pendingSignal?.aborted).toBe(true)
    channel?.close()
    await until(events, 'closed')
  })
})

describe('the Claude ACP live channel', () => {
  test('closes the advertised vendor Session before ending its channel', async () => {
    const events: LiveSessionChannelEvent[] = []
    const channel = createClaudeAcpRegistration().openLiveSession?.(
      start('close me'),
      undefined,
      (event) => events.push(event),
    )
    await until(events, 'turn.completed')
    channel?.close()
    await until(events, 'closed')
    const requests = await readFile(path.join(root, 'mock-acp-requests.jsonl'), 'utf8').catch(
      () => '',
    )
    expect(requests).toContain('session/close')
  })

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
    await until(events, 'closed')
  })
})
