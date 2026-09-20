// The #2111 repro: an `external` Session whose transcript a real terminal is still writing.
//
// It runs the shipped main-process reader against a fixture transcript and a separate writer
// process, and drives it the way the renderer does: a Feed read and a Roster poll, each every
// 500 ms (SESSION_REFRESH_MS), one in flight at a time, plus a ping standing in for every other
// IPC the window needs to stay clickable. It is red by design until #2102 lands, so no gate runs
// it; `docs/research/2026-09-14-feed-stall-freeze-mechanism.md` carries the readings.
//
//   bun tools/sessions/stalled-feed-repro.ts             # stalls, exit 1
//   APPEND=0 bun tools/sessions/stalled-feed-repro.ts    # settles, exit 0
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createSessionReader } from '../../src/domains/sessions/main/reader'
import { claudeSessionSource } from '../../src/harnesses/claude/sessions/read-sessions'

const SESSION = 'external-live'
const LINES = Number(process.env.LINES ?? '100000')
const APPEND_EVERY_MS = Number(process.env.APPEND_EVERY_MS ?? '10')
const APPEND = process.env.APPEND !== '0'
// The Turn ending: past this the writer stops and the reader is watched for recovery.
const APPEND_STOP_MS = Number(process.env.APPEND_STOP_MS ?? '0')
const WATCH_MS = Number(process.env.WATCH_MS ?? '20000')
const POLL_MS = 500
const PING_MS = 100
// A window that answers every ping inside this is clickable; one that does not is the freeze.
const PING_BUDGET_MS = 250

function line(index: number) {
  return `${JSON.stringify({
    type: 'assistant',
    uuid: `${SESSION}-${index}`,
    timestamp: new Date(Date.UTC(2026, 8, 13, 9, 0, 0) + index * 1000).toISOString(),
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: `Message ${index}. ${'prose '.repeat(40)}` }],
    },
  })}\n`
}

async function writeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-2111-'))
  const project = path.join(root, 'project-one')
  await mkdir(project, { recursive: true })
  const file = path.join(project, `${SESSION}.jsonl`)
  await writeFile(file, Array.from({ length: LINES }, (_, index) => line(index)).join(''))
  return { root, file }
}

// Started, then watched until the file actually grows: the reader must open on a moving target.
async function startWriter(file: string) {
  if (!APPEND) return undefined
  const writer = spawn(
    process.execPath,
    [
      path.join(import.meta.dirname, 'stalled-feed-writer.ts'),
      file,
      String(APPEND_EVERY_MS),
      String(LINES),
    ],
    { stdio: 'ignore' },
  )
  const before = (await stat(file)).size
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 20))
    if ((await stat(file)).size > before) break
  }
  if (APPEND_STOP_MS > 0) setTimeout(() => writer.kill(), APPEND_STOP_MS)
  return writer
}

const { root, file } = await writeFixture()
const writer = await startWriter(file)
const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
const opened = performance.now()
let feedReads = 0
let feedSettledMs: number | null = null
let feedBytes = 0
let rosterPolls = 0
let maxPingMs = 0
let maxRssMb = 0
let running = true
const rss = setInterval(() => {
  maxRssMb = Math.max(maxRssMb, process.memoryUsage().rss / 1024 / 1024)
}, 200)

const feedQuery = async () => {
  // Mirrors the renderer's own cache: the revision from the last reply that carried rows, sent
  // back on the next poll so an unchanged or appended reply can fire instead of the whole Feed.
  let revision: string | null = null
  while (running) {
    feedReads += 1
    const reply = await reader.readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: `feed-${feedReads}`,
      sessionId: SESSION,
      subagentId: null,
      revision,
    })
    feedBytes += JSON.stringify(reply).length
    if ('revision' in reply) revision = reply.revision
    if (feedSettledMs === null && reply.type !== 'session.error') {
      feedSettledMs = performance.now() - opened
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

const rosterQuery = async () => {
  while (running) {
    await reader.listSessions({
      version: 1,
      type: 'session.list',
      requestId: `list-${rosterPolls}`,
      projectRoot: null,
    })
    rosterPolls += 1
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

// One trivial main-process task: the cheapest thing a click can ask for.
const pingProbe = async () => {
  while (running) {
    const sent = performance.now()
    await new Promise((resolve) => setImmediate(resolve))
    maxPingMs = Math.max(maxPingMs, performance.now() - sent)
    await new Promise((resolve) => setTimeout(resolve, PING_MS))
  }
}

void feedQuery()
void rosterQuery()
void pingProbe()
await new Promise((resolve) => setTimeout(resolve, WATCH_MS))
running = false
clearInterval(rss)
writer?.kill()

const settled = feedSettledMs !== null
const ok = settled && maxPingMs < PING_BUDGET_MS
console.log(
  JSON.stringify({
    ok,
    feedSettled: settled,
    feedSettledMs: feedSettledMs === null ? null : Math.round(feedSettledMs),
    feedReads,
    feedIpcBytes: feedBytes,
    rosterPollsCompleted: rosterPolls,
    maxPingMs: Math.round(maxPingMs),
    maxRssMb: Math.round(maxRssMb),
    lines: LINES,
    appendEveryMs: APPEND ? APPEND_EVERY_MS : null,
  }),
)
await rm(root, { recursive: true, force: true })
process.exit(ok ? 0 : 1)
