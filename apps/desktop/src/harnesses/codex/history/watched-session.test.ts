import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionProjection } from '@/domains/sessions/next/contract/session-projection-contract'
import type { HistoryTransport } from './vendor-history'
import { matchWorkspace, reconcileStoredHistory } from './watched-projection'
import { createWatchedCodexSessions } from './watched-session'

const THREAD = {
  id: 'thread-1',
  cwd: '/work/checkout',
  name: 'Old notes',
  branch: 'feature',
  updatedAt: 1_700_000_000,
  status: { type: 'idle' },
  turns: [
    {
      id: 'turn-1',
      status: 'completed',
      startedAt: 1_700_000_000,
      items: [
        { id: 'message-1', type: 'userMessage', text: 'Remember this' },
        { id: 'message-2', type: 'agentMessage', text: 'Noted' },
      ],
    },
  ],
}

function transport(threads = [THREAD]): HistoryTransport {
  return {
    request: (method, params) => {
      if (method === 'thread/list') return Promise.resolve({ data: threads, nextCursor: null })
      if (method === 'thread/turns/list') {
        return Promise.reject(new Error('thread/turns/list requires experimentalApi capability'))
      }
      const thread = threads.find((candidate) => candidate.id === params.threadId)
      return Promise.resolve({ thread })
    },
  }
}

function projection(id: string, text: string): SessionProjection {
  return {
    session: { harness: 'codex', nativeId: id },
    posture: 'managed',
    sourceHealth: 'ready',
    revision: 1,
    workspace: { id: 'workspace-1' },
    status: 'running',
    title: 'Live',
    turns: [{ id: 'turn-1', status: 'running', startedAt: 1, completedAt: null }],
    messages: [{ id: 'message-1', turnId: 'turn-1', role: 'user', text }],
    toolCalls: [],
    pendingApprovals: [],
    pendingQuestions: [],
    usage: { inputTokens: 1, outputTokens: 2 },
  }
}

test('maps a known checkout to its Workspace and leaves an unknown checkout unattached', async () => {
  assert.deepEqual(
    matchWorkspace('/work/checkout', [{ id: 'workspace-1', path: '/work/checkout' }]),
    {
      id: 'workspace-1',
    },
  )
  assert.equal(
    matchWorkspace('/somewhere/else', [{ id: 'workspace-1', path: '/work/checkout' }]),
    null,
  )
  const known = [{ id: 'workspace-1', path: '/work/checkout' }]
  const sessions = createWatchedCodexSessions({
    transport: transport(),
    knownWorkspaces: async () => known,
  })
  const [first] = await sessions.refresh()
  assert.equal(first?.posture, 'watched')
  assert.equal(first?.workspace?.id, 'workspace-1')
  const [again] = await sessions.refresh()
  assert.equal(again?.workspace?.id, 'workspace-1')
  assert.equal(again?.posture, 'watched')
})

test('keeps the same Workspace when the vendor branch changes', async () => {
  let branch = 'feature'
  const sessions = createWatchedCodexSessions({
    transport: {
      request: (method, params) => {
        const thread = { ...THREAD, branch }
        if (method === 'thread/list') return Promise.resolve({ data: [thread], nextCursor: null })
        return Promise.resolve({ thread: { ...thread, id: params.threadId } })
      },
    },
    knownWorkspaces: async () => [{ id: 'workspace-1', path: '/work/checkout' }],
  })
  const [before] = await sessions.refresh()
  branch = 'other'
  const [after] = await sessions.refresh()
  assert.equal(before?.workspace?.id, 'workspace-1')
  assert.equal(after?.workspace?.id, 'workspace-1')
})

test('reconciles vendor history without repeating live events', () => {
  const live = projection('thread-1', 'Remember this')
  const stored = projection('thread-1', 'Remember this')
  stored.turns.unshift({ id: 'turn-0', status: 'completed', startedAt: 0, completedAt: 1 })
  stored.messages.unshift({ id: 'message-0', turnId: 'turn-0', role: 'user', text: 'Earlier' })
  stored.messages.push({ id: 'message-2', turnId: 'turn-1', role: 'agent', text: 'Noted' })
  stored.posture = 'watched'
  const reconciled = reconcileStoredHistory(live, stored)
  assert.deepEqual(
    reconciled.messages.map((message) => message.id),
    ['message-0', 'message-1', 'message-2'],
  )
  assert.deepEqual(
    reconciled.turns.map((turn) => turn.id),
    ['turn-0', 'turn-1'],
  )
  assert.equal(reconciled.posture, 'managed')
})

test('a restarted catalog reads surviving Sessions as watched', async () => {
  const first = createWatchedCodexSessions({
    transport: transport(),
    knownWorkspaces: async () => [],
  })
  await first.refresh()
  const restarted = createWatchedCodexSessions({
    transport: transport(),
    knownWorkspaces: async () => [],
  })
  const [listed] = await restarted.refresh()
  const session = await restarted.readProjection('thread-1')
  assert.equal(listed?.posture, 'watched')
  assert.equal(session?.posture, 'watched')
  assert.equal(session?.messages[0]?.text, 'Remember this')
  assert.equal(session?.workspace, null)
})

test('lists Codex thread summaries without requesting their turns', async () => {
  const calls: string[] = []
  const sessions = createWatchedCodexSessions({
    transport: {
      request: (method) => {
        calls.push(method)
        if (method === 'thread/list') return Promise.resolve({ data: [THREAD], nextCursor: null })
        throw new Error(`unexpected ${method}`)
      },
    },
    knownWorkspaces: async () => [],
  })

  await sessions.refresh()

  assert.deepEqual(calls, ['thread/list'])
})

test('shares one stalled roster request across overlapping reads', async () => {
  let resolve: ((value: unknown) => void) | undefined
  let calls = 0
  const sessions = createWatchedCodexSessions({
    transport: {
      request: (method) => {
        assert.equal(method, 'thread/list')
        calls += 1
        return new Promise((done) => {
          resolve = done
        })
      },
    },
    knownWorkspaces: async () => [],
  })

  const first = sessions.refresh()
  const second = sessions.refresh()
  while (resolve === undefined) await new Promise((done) => setTimeout(done, 0))
  resolve({ data: [THREAD], nextCursor: null })

  await Promise.all([first, second])

  assert.equal(calls, 1)
})
