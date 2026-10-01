import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { LiveSessionChannelEvent, LiveSessionControls } from '@/harnesses/registration'
import { mockAcpSessionInput, waitForMockAcpEvent } from '@/mocks/cli/claude-acp/mock-acp-session'
import { recordedAcpDiscovery as recorded } from '@/mocks/recordings/claude-acp'
import { writeMockClaudeAcp } from '../../../mocks/cli/claude-acp/mock-claude-acp-cli'
import { connectAcpAgent } from './acp-client'
import { acpExecutableOverride } from './acp-proof-protocol'
import { createAcpRegistrations } from './acp-registration-factory'

const SESSION_CLAUDE_ACP_EXECUTABLE_ENV = acpExecutableOverride('claude-acp')

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

function openPermissionSession(controls: LiveSessionControls, events: LiveSessionChannelEvent[]) {
  return createAcpRegistrations()['claude-acp'].openLiveSession?.(
    mockAcpSessionInput(root, 'Request ACP permission'),
    controls,
    (event) => events.push(event),
  )
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
    const listing = await createAcpRegistrations()['claude-acp'].listSessionSummaries({
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
      createAcpRegistrations()['claude-acp'].listSessionSummaries({
        knownNativeIds: ['missing-saved'],
      }),
    ).rejects.toThrow('repeated a cursor')
  })
})

describe('the Claude ACP recorded discovery', () => {
  test('reads the real producer listing and keeps its title as a preview', async () => {
    await writeMockClaudeAcp(root, path.join(root, 'transcripts'), {
      listing: recorded.listing.result,
    })
    expect(
      await createAcpRegistrations()['claude-acp'].listSessionSummaries({
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
    const registration = createAcpRegistrations()['claude-acp']
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
    const registration = createAcpRegistrations()['claude-acp']
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
      preview: 'Saved second',
    })
  })
})

describe('the Claude ACP live channel', () => {
  test('resumes by loading history and keeps prompt identities after a process restart', async () => {
    const registration = createAcpRegistrations()['claude-acp']
    const first: LiveSessionChannelEvent[] = []
    const initial = registration.openLiveSession?.(
      mockAcpSessionInput(root, 'before restart'),
      undefined,
      (event) => first.push(event),
    )
    await waitForMockAcpEvent(first, 'turn.completed')
    initial?.close()
    await waitForMockAcpEvent(first, 'closed')
    const identity = first.find((event) => event.type === 'identity')
    if (identity?.type !== 'identity') throw new Error('No native identity.')
    const later: LiveSessionChannelEvent[] = []
    const resumed = registration.openLiveSession?.(
      {
        ...mockAcpSessionInput(root, 'after restart'),
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
    await waitForMockAcpEvent(later, 'turn.completed')
    resumed?.close()
    await waitForMockAcpEvent(later, 'closed')
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
    const channel = openPermissionSession(controls, events)
    await waitForMockAcpEvent(events, 'turn.completed')
    expect(offered).toBe(false)
    expect(events.some((event) => event.type === 'feed' && event.body.type === 'permission')).toBe(
      false,
    )
    channel?.close()
    await waitForMockAcpEvent(events, 'closed')
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
    const channel = openPermissionSession(controls, events)
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
    await waitForMockAcpEvent(events, 'turn.completed')
    expect(pendingSignal?.aborted).toBe(true)
    channel?.close()
    await waitForMockAcpEvent(events, 'closed')
  })
})

describe('the Claude ACP live channel', () => {
  test('closes the advertised vendor Session before ending its channel', async () => {
    const events: LiveSessionChannelEvent[] = []
    const channel = createAcpRegistrations()['claude-acp'].openLiveSession?.(
      mockAcpSessionInput(root, 'close me'),
      undefined,
      (event) => events.push(event),
    )
    await waitForMockAcpEvent(events, 'turn.completed')
    channel?.close()
    await waitForMockAcpEvent(events, 'closed')
    const requests = await readFile(path.join(root, 'mock-acp-requests.jsonl'), 'utf8').catch(
      () => '',
    )
    expect(requests).toContain('session/close')
  })
})
