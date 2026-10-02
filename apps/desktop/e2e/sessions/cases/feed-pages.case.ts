// A large Session opens on its newest page only, and scrolling to its first row loads the page
// before it with the rows on screen held still, for Claude and Codex alike (#3151).
import { randomUUID } from 'node:crypto'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import { FEED_PAGE_ROWS } from '@/domains/sessions/api/feed'
import {
  buildHistory,
  historyPath,
  refreshTurn,
  writeHistory,
} from '../../../mocks/cli/claude/long-claude-history'
import { mockCodexStateFile } from '../../../mocks/cli/codex/mock-codex-cli'
import { ACTIVE_VIEWPORT } from '../feed-selectors'
import { listedSession } from '../fixture-sessions'
import { openSessionByClick } from '../gestures'
import { sessionFeed } from '../page-trpc'

// About 2,400 Claude rows: past the first 1 MiB tail read, so older pages also widen the read.
export const LONG_CLAUDE_BYTES = 3_000_000
const LONG_CODEX_TURNS = 300
const LONG_CODEX_THREAD_ID = '00000000-0000-4000-9000-000000000001'
const OLDER_PAGES = 3

// Written while the app is closed, so the app finds it as a Session started outside Argo.
export async function writeLongClaudeSession(transcripts: string, project: string) {
  const nativeId = randomUUID()
  const history = buildHistory(project, LONG_CLAUDE_BYTES)
  const file = historyPath(transcripts, project, nativeId)
  await writeHistory(file, history.text)
  return { nativeId, file, lastUuid: history.lastUuid }
}

type StoredTurn = { id: string; items: { id: string }[] }
type StoredThread = { id: string; name?: string; turns: StoredTurn[] }

// One Turn again and again, each copy with ids of its own.
export function longCodexTurns(turn: StoredTurn, prefix = '') {
  return Array.from({ length: LONG_CODEX_TURNS }, (_, index) => ({
    ...turn,
    id: `${prefix}long-turn-${index}`,
    items: turn.items.map((item) => ({ ...item, id: `${prefix}${item.id}-long-${index}` })),
  }))
}

// A copy of the mock store's first thread whose one Turn repeats.
export async function writeLongCodexThread(root: string): Promise<string> {
  const file = mockCodexStateFile(root)
  const threads = JSON.parse(await readFile(file, 'utf8')) as StoredThread[]
  const [template] = threads
  const turn = template?.turns[0]
  if (template === undefined || turn === undefined)
    throw new Error('The mock Codex store holds no thread with a Turn.')
  const turns = longCodexTurns(turn)
  const long = { ...template, id: LONG_CODEX_THREAD_ID, name: 'Long Codex history', turns }
  await writeFile(file, JSON.stringify([...threads, long]))
  return LONG_CODEX_THREAD_ID
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
