// A large Session opens on its newest page only, and scrolling to its first row loads the page
// before it with the rows on screen held still, for Claude and Codex alike (#3151).
import { randomUUID } from 'node:crypto'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import { FEED_PAGE_ROWS, type FeedReading } from '@/domains/sessions/api/feed'
import {
  buildHistory,
  historyPath,
  longReplyTurn,
  refreshTurn,
  writeHistory,
} from '../../../mocks/cli/claude/long-claude-history'
import { mockCodexStateFile } from '../../../mocks/cli/codex/mock-codex-cli'
import { ACTIVE_VIEWPORT } from '../feed-selectors'
import { listedSession } from '../fixture-sessions'
import { openSessionByClick } from '../gestures'
import type { PackagedSession } from '../packaged-session-harness'
import { sessionFeed } from '../page-trpc'

// About 2,400 Claude rows: past the first 1 MiB tail read, so older pages also widen the read.
export const LONG_CLAUDE_BYTES = 3_000_000
const LONG_CODEX_TURNS = 300
const LONG_CODEX_THREAD_ID = '00000000-0000-4000-9000-000000000001'
const OLDER_PAGES = 3
// Two pages each, the size of the Session the blind tester read.
const TWO_PAGE_CLAUDE_BYTES = 520_000
const TWO_PAGE_CODEX_TURNS = 72
const TWO_PAGE_CODEX_THREAD_ID = '00000000-0000-4000-9000-000000000002'

// Written while the app is closed, so the app finds it as a Session started outside Argo.
export async function writeLongClaudeSession(
  transcripts: string,
  project: string,
  bytes = LONG_CLAUDE_BYTES,
) {
  const nativeId = randomUUID()
  const history = buildHistory(project, bytes)
  const file = historyPath(transcripts, project, nativeId)
  await writeHistory(file, history.text)
  return { nativeId, file, lastUuid: history.lastUuid }
}

// A Claude and a Codex Session of two pages each, written while the app is closed.
export async function writeTwoPageSessions(session: PackagedSession) {
  const { claudeTranscripts, project } = session.fixture
  const native = { claude: '', codex: '' }
  await session.restart(async () => {
    native.claude = (
      await writeLongClaudeSession(claudeTranscripts, project, TWO_PAGE_CLAUDE_BYTES)
    ).nativeId
    native.codex = await writeLongCodexThread(session.root, {
      id: TWO_PAGE_CODEX_THREAD_ID,
      turns: TWO_PAGE_CODEX_TURNS,
    })
  })
  return { claude: await listedSession(native.claude), codex: await listedSession(native.codex) }
}

type StoredTurn = { id: string; items: { id: string; type: string }[] }
export type StoredThread = { id: string; name?: string; turns: StoredTurn[] }

// Two pages: a few short Turns, then one prompt whose reply alone fills the newest page.
const SHORT_TURNS_BYTES = 40_000
const LONG_REPLY_STEPS = 120
const SHORT_CODEX_TURNS = 5
const LONG_CODEX_REPLY_STEPS = 250
const PROMPTLESS_TAIL_CODEX_THREAD_ID = '00000000-0000-4000-9000-000000000003'

async function writePromptlessTailClaudeSession(transcripts: string, project: string) {
  const nativeId = randomUUID()
  const turns = buildHistory(project, SHORT_TURNS_BYTES)
  const reply = longReplyTurn(project, turns.lastUuid, LONG_REPLY_STEPS)
  await writeHistory(historyPath(transcripts, project, nativeId), turns.text + reply.text)
  return nativeId
}

// The template Turn's reply items again and again, each copy with ids of its own, after its prompt.
function longCodexReply(turn: StoredTurn, prefix: string) {
  const ids = (suffix: string) => (item: StoredTurn['items'][number]) => ({
    ...item,
    id: `${prefix}${item.id}-${suffix}`,
  })
  const prompt = turn.items.filter(({ type }) => type === 'userMessage')
  const reply = turn.items.filter(({ type }) => type !== 'userMessage')
  const steps = Array.from({ length: LONG_CODEX_REPLY_STEPS }, (_, step) =>
    reply.map(ids(`step-${step}`)),
  )
  return {
    ...turn,
    id: `${prefix}long-reply`,
    items: [...prompt.map(ids('prompt')), ...steps.flat()],
  }
}

// A Claude and a Codex Session whose newest page holds no prompt, written while the app is closed.
export async function writePromptlessTailSessions(session: PackagedSession) {
  const { claudeTranscripts, project } = session.fixture
  const native = { claude: '', codex: '' }
  await session.restart(async () => {
    native.claude = await writePromptlessTailClaudeSession(claudeTranscripts, project)
    native.codex = await writeCodexThread(session.root, {
      id: PROMPTLESS_TAIL_CODEX_THREAD_ID,
      name: 'Promptless tail Codex history',
      turns: (turn, prefix) => [
        ...longCodexTurns(turn, prefix, SHORT_CODEX_TURNS),
        longCodexReply(turn, prefix),
      ],
    })
  })
  return { claude: await listedSession(native.claude), codex: await listedSession(native.codex) }
}

// One Turn again and again, each copy with ids of its own.
export function longCodexTurns(turn: StoredTurn, prefix = '', count = LONG_CODEX_TURNS) {
  return Array.from({ length: count }, (_, index) => ({
    ...turn,
    id: `${prefix}long-turn-${index}`,
    items: turn.items.map((item) => ({ ...item, id: `${prefix}${item.id}-long-${index}` })),
  }))
}

// A copy of the mock store's first thread, with Turns built from its first one.
async function writeCodexThread(
  root: string,
  thread: { id: string; name: string; turns: (turn: StoredTurn, prefix: string) => StoredTurn[] },
): Promise<string> {
  const file = mockCodexStateFile(root)
  const threads = JSON.parse(await readFile(file, 'utf8')) as StoredThread[]
  const [template] = threads
  const turn = template?.turns[0]
  if (template === undefined || turn === undefined)
    throw new Error('The mock Codex store holds no thread with a Turn.')
  const { id, name } = thread
  const written = { ...template, id, name, turns: thread.turns(turn, `${id}-`) }
  await writeFile(file, JSON.stringify([...threads, written]))
  return id
}

// A copy of the mock store's first thread whose one Turn repeats.
export function writeLongCodexThread(
  root: string,
  { id = LONG_CODEX_THREAD_ID, turns: count = LONG_CODEX_TURNS } = {},
): Promise<string> {
  return writeCodexThread(root, {
    id,
    name: 'Long Codex history',
    turns: (turn, prefix) => longCodexTurns(turn, prefix, count),
  })
}

// Scrolls to the first row and, once the rows there have mounted, watches them each frame until
// the older page has come in: none of them may move. Answers each move it saw.
function scrollToStartWatchingRows(page: Page) {
  return page.evaluate(async (selector) => {
    const viewport = document.querySelector(selector)
    if (viewport === null) throw new Error('No active Feed viewport.')
    // The rows wholly in view and their offsets; a row cut by the top edge may be one the older
    // page just put there, still at its estimated height.
    const inView = (element: Element) => {
      const bounds = element.getBoundingClientRect()
      const offsets: Record<string, number> = {}
      for (const row of element.querySelectorAll<HTMLElement>('[data-feed-row]')) {
        const { top, bottom } = row.getBoundingClientRect()
        if (top >= bounds.top && bottom <= bounds.bottom)
          offsets[row.dataset.feedRow ?? ''] = top - bounds.top
      }
      return offsets
    }
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    viewport.scrollTop = 0
    await frame()
    await frame()
    const held = inView(viewport)
    const moves: { id: string; before: number; after: number }[] = []
    const started = performance.now()
    while (performance.now() - started < 2_000) {
      await frame()
      const current = inView(viewport)
      for (const [id, before] of Object.entries(held)) {
        const after = current[id]
        if (after !== undefined && Math.abs(after - before) > 1) moves.push({ id, before, after })
      }
    }
    return moves.slice(0, 5)
  }, ACTIVE_VIEWPORT)
}

async function provePages(page: Page, sessionId: string) {
  await openSessionByClick(page, sessionId)
  await page.locator(`${ACTIVE_VIEWPORT} [data-feed-row]`).first().waitFor()
  const first = await sessionFeed(page, sessionId)
  expect(first.entries).toHaveLength(FEED_PAGE_ROWS)
  expect(first.hasOlder).toBe(true)

  let loaded = FEED_PAGE_ROWS
  for (let older = 0; older < OLDER_PAGES; older += 1) {
    expect(await scrollToStartWatchingRows(page)).toEqual([])
    const { entries } = await sessionFeed(page, sessionId)
    expect(entries.length).toBeGreaterThan(loaded)
    loaded = entries.length
  }
}

export async function proveClaudeFeedPages(
  page: Page,
  session: { nativeId: string; file: string; lastUuid: string; project: string },
) {
  const sessionId = await listedSession(session.nativeId)
  await provePages(page, sessionId)
  // A row written while the reader is in older pages still lands at the end; an outside Session is
  // read again when the window takes focus.
  const appended = refreshTurn(session.project, session.lastUuid)
  await appendFile(session.file, appended.text)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect
    .poll(async () =>
      (await sessionFeed(page, sessionId)).entries
        .slice(-2)
        .some(({ id }) => id.includes(appended.refreshUuid)),
    )
    .toBe(true)
}

export async function proveCodexFeedPages(page: Page) {
  await provePages(page, await listedSession(LONG_CODEX_THREAD_ID))
}

// More than any Session here has.
const MAX_OLDER_PAGES = 10

const holdsPrompt = ({ entries }: FeedReading) =>
  entries.some(({ row }) => row.shape === 'prose' && row.role === 'user')

// A prompt that arrives with an older page is history, not one just sent, so the reader is not
// carried up to it when the newest page held no prompt.
export async function proveOlderPromptHoldsReader(
  page: Page,
  session: { sessionId: string; label: string },
) {
  const { sessionId, label } = session
  await openSessionByClick(page, sessionId)
  await page.locator(`${ACTIVE_VIEWPORT} [data-feed-row]`).first().waitFor()
  const first = await sessionFeed(page, sessionId)
  expect(first.hasOlder, `${label}: opens on more than one page`).toBe(true)
  expect(holdsPrompt(first), `${label}: the newest page holds no prompt`).toBe(false)

  // The prompt comes in with the oldest page, and each page before it holds the reader too.
  for (let pages = 0; (await sessionFeed(page, sessionId)).hasOlder; pages += 1) {
    if (pages === MAX_OLDER_PAGES) throw new Error(`${label}: over ${MAX_OLDER_PAGES} older pages.`)
    expect(await scrollToStartWatchingRows(page), `${label}: no row jumps`).toEqual([])
  }
  const loaded = await sessionFeed(page, sessionId)
  expect(holdsPrompt(loaded), `${label}: the oldest page holds the prompt`).toBe(true)
}
