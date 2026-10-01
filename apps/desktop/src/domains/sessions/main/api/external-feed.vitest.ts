import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { initTRPC } from '@trpc/server'
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest'
import { sessionTable } from '@/database/session/schema'
import type { FeedReading } from '@/domains/sessions/api/feed'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/harnesses/claude/proof-protocol'
import type { CodexAppServerClient } from '@/harnesses/codex/app-server'
import { createHarnessRegistry, type HarnessRegistry } from '@/harnesses/registry'
import type { mockClaudeAgentsCli } from '@/mocks/cli/claude/mock-claude-agents'
import { claudeProjectFolder } from '@/mocks/cli/claude/mock-claude-transcripts'
import { holdCodexWriterLock } from '@/mocks/cli/codex/mock-codex-external-threads'
import { mockExternalClis } from '@/mocks/cli/mock-external-clis'
import { guardRealUserConfig } from '@/mocks/cli/real-user-config'
import { hookEvent, postHook } from '@/mocks/cli/status-hooks'
import { collect } from '@/mocks/sessions/session-feed-harness'
import { insertSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'
import { HistoryReadLimit, SessionFeedReaders } from '../feed'
import { SessionEventJournal } from '../live'
import { ExternalSessionPoll } from './external-session-poll'
import { sessionFeedProcedures } from './session-feed'
import { StatusHookReceiver } from './status-hook-receiver'

const SESSION = '00000000-0000-4000-8000-0000000000e1'
const HARNESSES = ['claude', 'codex'] as const
type FeedHarness = (typeof HARNESSES)[number]

const realConfigUnchanged = guardRealUserConfig()
afterAll(realConfigUnchanged)

let root: string
let cwd: string
let clis: Awaited<ReturnType<typeof mockExternalClis>>
let agents: ReturnType<typeof mockClaudeAgentsCli>
let codex: CodexAppServerClient
let registry: HarnessRegistry
let caller: ReturnType<typeof sessionListCaller>
let live: Set<string>
let poll: ExternalSessionPoll
let receiver: StatusHookReceiver
let readers: SessionFeedReaders
let reads: number
// Holds every vendor read until the test opens it.
let gate: Promise<void>
let openGate: () => void
let releases: (() => Promise<void>)[]
let codexHistory: string

beforeEach(async () => {
  clis = await mockExternalClis('argo-external-feed-', (folder) => ({
    ARGO_CODEX_VENDOR_HISTORY: path.join(folder, 'codex-vendor-history.json'),
  }))
  root = clis.root
  codexHistory = path.join(root, 'codex-vendor-history.json')
  agents = clis.agents
  codex = clis.codex
  agents.answer([])
  cwd = path.join(root, 'work')
  mkdirSync(cwd)
  vi.stubEnv(SESSION_CLAUDE_EXECUTABLE_ENV, agents.executable)
  registry = createHarnessRegistry(codex)
  caller = sessionListCaller()
  live = new Set()
  releases = []
  reads = 0
  gate = Promise.resolve()
})

afterEach(async () => {
  receiver?.stop()
  poll?.stop()
  for (const release of releases) await release()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  caller.stopWatching()
  caller.database.$client.close()
  await clis.dispose()
})

function holdReads() {
  gate = new Promise((resolve) => {
    openGate = resolve
  })
}

// The app's own wiring: one shared read limit, the Harness registry's vendor reads, the poll and
// the hook receiver, with the Feed asked to read again through the readers.
async function start({ hooks = true } = {}) {
  const limit = new HistoryReadLimit()
  readers = new SessionFeedReaders({
    database: caller.database,
    changes: caller.sessionListChanges,
    journal: new SessionEventJournal(),
    hasLiveChannel: (sessionId) => live.has(sessionId),
    readHistory: (harness, target, signal) =>
      limit.run(async () => {
        reads += 1
        await gate
        return registry[harness].readHistory(target)
      }, signal),
  })
  const harnesses = HARNESSES.map((harness) => {
    const external = registry[harness].externalSessions
    if (external === undefined) throw new Error(`${harness} reads no external Sessions.`)
    return { harness, external }
  })
  poll = new ExternalSessionPoll({
    database: caller.database,
    changes: caller.sessionListChanges,
    harnesses,
    hasLiveChannel: (sessionId) => live.has(sessionId),
    discover: () => {},
    refreshFeed: (sessionId) => readers.refresh({ sessionId, subagentId: null }),
  })
  receiver = new StatusHookReceiver({ poll, harnesses })
  if (hooks) await receiver.start()
}

function openFeed() {
  const feeds = initTRPC.create().router(sessionFeedProcedures(readers)).createCaller({})
  return feeds.sessionFeed({ sessionId: SESSION, subagentId: null }).then(collect)
}

async function until(check: () => boolean, label: string) {
  const deadline = Date.now() + 5_000
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}.`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const texts = (reading: FeedReading | undefined) =>
  (reading?.entries ?? []).flatMap(({ row }) => ('text' in row ? [row.text] : []))

async function shows(feed: { latest: () => FeedReading | undefined }, expected: string[]) {
  await until(
    () => feed.latest()?.state === 'ready' && texts(feed.latest()).join('|') === expected.join('|'),
    `the Feed to show ${expected.join(', ')}`,
  )
}

// What a CLI running outside Argo writes as its Session goes on, read back only through the vendor.
type ExternalWriter = {
  say: (role: 'user' | 'assistant', text: string) => void
  delegate: () => void
  listLive: () => Promise<void>
  exit: () => Promise<void>
}

function claudeWriter(): ExternalWriter {
  const folder = claudeProjectFolder(
    path.join(process.env.CLAUDE_CONFIG_DIR as string, 'projects'),
    cwd,
  )
  mkdirSync(folder, { recursive: true })
  const file = path.join(folder, `${SESSION}.jsonl`)
  let parentUuid: string | null = null
  let count = 0
  const write = (type: 'user' | 'assistant', content: unknown) => {
    count += 1
    const uuid = `00000000-0000-4000-8000-${String(count).padStart(12, '0')}`
    const record = {
      type,
      cwd,
      sessionId: SESSION,
      timestamp: new Date(Date.UTC(2026, 9, 1, 10, 0, count)).toISOString(),
      uuid,
      parentUuid,
      message:
        type === 'user'
          ? { role: 'user', content }
          : { role: 'assistant', stop_reason: 'end_turn', content },
    }
    appendFileSync(file, `${JSON.stringify(record)}\n`)
    parentUuid = uuid
  }
  return {
    say: (role, text) => write(role, role === 'user' ? text : [{ type: 'text', text }]),
    delegate: () => {
      write('assistant', [
        {
          type: 'tool_use',
          id: 'agent-call',
          name: 'Agent',
          input: { description: 'Review feed', subagent_type: 'reviewer', prompt: 'Review.' },
        },
      ])
      // The launch result names the Subagent, as the recorded `delegationHistory` one does.
      const launched =
        'Async agent launched successfully.\nagentId: a0d1e2f3a4b5c6d7e (internal ID)'
      write('user', [{ type: 'tool_result', tool_use_id: 'agent-call', content: launched }])
    },
    listLive: async () => {
      agents.answer([{ ...agents.recorded()[1], sessionId: SESSION }])
    },
    exit: async () => agents.answer([]),
  }
}

function codexWriter(): ExternalWriter {
  const items: unknown[] = []
  const write = () =>
    writeFileSync(
      codexHistory,
      JSON.stringify({
        threads: [
          {
            id: SESSION,
            cwd,
            name: null,
            updatedAt: 1_790_000_000,
            status: { type: 'idle' },
            turns: [{ id: 'turn-1', status: 'completed', startedAt: 1_790_000_000, items }],
          },
        ],
      }),
    )
  return {
    say: (role, text) => {
      const id = `item-${items.length + 1}`
      items.push(
        role === 'user'
          ? { type: 'userMessage', id, content: [{ type: 'text', text, text_elements: [] }] }
          : { type: 'agentMessage', id, text, phase: null },
      )
      write()
    },
    delegate: () => {
      for (const kind of ['started', 'completed'])
        items.push({
          type: 'subAgentActivity',
          id: `agent-${kind}`,
          kind,
          agentThreadId: 'agent-thread',
          agentPath: '/root/review_feed',
        })
      write()
    },
    listLive: async () => {
      releases.push(await holdCodexWriterLock(process.env.CODEX_HOME as string, SESSION))
    },
    exit: async () => {
      for (const release of releases.splice(0)) await release()
    },
  }
}

function external(harness: FeedHarness): ExternalWriter {
  insertSession(caller.database, { id: SESSION, harness, nativeId: SESSION, cwd, status: 'idle' })
  const writer = harness === 'claude' ? claudeWriter() : codexWriter()
  writer.say('user', 'Say hello')
  return writer
}

const post = (harness: FeedHarness, event: string) =>
  postHook(receiver.port, harness, hookEvent(harness, event, SESSION))

test.each(HARNESSES)(
  'an open %s Feed reads again on each hook event that moves the history',
  async (harness) => {
    await start()
    const writer = external(harness)
    const feed = await openFeed()
    await shows(feed, ['Say hello'])
    writer.say('assistant', 'Hello')
    await post(harness, 'PostToolUse')
    await shows(feed, ['Say hello', 'Hello'])
    writer.say('user', 'Again')
    await post(harness, 'UserPromptSubmit')
    await shows(feed, ['Say hello', 'Hello', 'Again'])
    writer.say('assistant', 'Done')
    await post(harness, 'Stop')
    await shows(feed, ['Say hello', 'Hello', 'Again', 'Done'])
    // Events that write no Feed content read nothing.
    const before = reads
    await post(harness, 'PreToolUse')
    await post(harness, 'PermissionRequest')
    expect(reads).toBe(before)
    feed.subscription.unsubscribe()
  },
)

test.each(HARNESSES)(
  'a closed %s Feed reads nothing on a hook event, and reads again when it opens',
  async (harness) => {
    await start()
    const writer = external(harness)
    const first = await openFeed()
    await shows(first, ['Say hello'])
    first.subscription.unsubscribe()
    const before = reads
    writer.say('assistant', 'Hello')
    await post(harness, 'Stop')
    expect(reads).toBe(before)
    const second = await openFeed()
    await shows(second, ['Say hello', 'Hello'])
    expect(reads).toBe(before + 1)
    second.subscription.unsubscribe()
  },
)

test.each(HARNESSES)(
  'a burst of %s hook events reads once in flight and once after',
  async (harness) => {
    await start()
    const writer = external(harness)
    const feed = await openFeed()
    await shows(feed, ['Say hello'])
    holdReads()
    writer.say('assistant', 'Hello')
    for (const event of ['PostToolUse', 'PostToolUse', 'Stop', 'UserPromptSubmit'])
      await post(harness, event)
    const burst = reads
    openGate()
    await shows(feed, ['Say hello', 'Hello'])
    await until(() => reads === burst + 1, 'the follow-up read')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(reads).toBe(burst + 1)
    feed.subscription.unsubscribe()
  },
)

test.each(HARNESSES)(
  'until its hooks fire an open %s Feed reads again each poll tick, and then stops',
  async (harness) => {
    await start()
    const writer = external(harness)
    await writer.listLive()
    const feed = await openFeed()
    await shows(feed, ['Say hello'])
    writer.say('assistant', 'Hello')
    await poll.tick()
    await shows(feed, ['Say hello', 'Hello'])
    await post(harness, 'SessionStart')
    const before = reads
    writer.say('assistant', 'Unread')
    await poll.tick()
    await poll.tick()
    expect(reads).toBe(before)
    expect(texts(feed.latest())).toEqual(['Say hello', 'Hello'])
    feed.subscription.unsubscribe()
  },
)

test.each(HARNESSES)(
  'an open %s Feed reads the last Turn once its CLI leaves the listing',
  async (harness) => {
    await start({ hooks: false })
    const writer = external(harness)
    await writer.listLive()
    await poll.tick()
    const feed = await openFeed()
    await shows(feed, ['Say hello'])
    writer.say('assistant', 'Goodbye')
    await writer.exit()
    await poll.tick()
    await shows(feed, ['Say hello', 'Goodbye'])
    feed.subscription.unsubscribe()
  },
)

test.each(HARNESSES)('a closed %s Feed starts no poll read', async (harness) => {
  await start({ hooks: false })
  const writer = external(harness)
  await writer.listLive()
  await poll.tick()
  writer.say('assistant', 'Hello')
  await poll.tick()
  expect(reads).toBe(0)
})

test.each(HARNESSES)(
  'an external %s Session lists no Subagent rows, and its Feed keeps the delegation',
  async (harness) => {
    await start({ hooks: false })
    const writer = external(harness)
    await writer.listLive()
    await poll.tick()
    writer.delegate()
    const feed = await openFeed()
    await poll.tick()
    await until(
      () => (feed.latest()?.entries ?? []).some(({ row }) => row.shape === 'subagent'),
      'the delegation row',
    )
    poll.flush()
    const listed = (await caller.list({ projectId: 'project-1' })).rows.find(
      ({ id }) => id === SESSION,
    )
    expect(listed?.subagents).toEqual([])
    feed.subscription.unsubscribe()
  },
)

test('the Claude and Codex Feeds show the same rows for the same work', async () => {
  await start()
  const rows: Record<FeedHarness, unknown> = { claude: null, codex: null }
  for (const harness of HARNESSES) {
    caller.database.delete(sessionTable).run()
    const writer = external(harness)
    writer.say('assistant', 'Hello')
    const feed = await openFeed()
    await shows(feed, ['Say hello', 'Hello'])
    rows[harness] = feed.latest()?.entries.map(({ row }) => ({
      shape: row.shape,
      ...('role' in row ? { role: row.role } : {}),
      ...('text' in row ? { text: row.text } : {}),
    }))
    feed.subscription.unsubscribe()
  }
  expect(rows.claude).toEqual(rows.codex)
})
