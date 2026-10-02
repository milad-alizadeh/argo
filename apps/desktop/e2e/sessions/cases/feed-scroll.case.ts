// Scrolling a long Feed from its newest row to its first and back is smooth: rows in view move
// only by the scroll the reader asked for, the viewport is never left blank, and frames are timed,
// for Claude and Codex alike, Argo-started and outside (#3151).
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, type TestInfo } from '@playwright/test'
import type { Page } from 'playwright-core'
import { buildHistory } from '../../../mocks/cli/claude/long-claude-history'
import { mockCodexStateFile } from '../../../mocks/cli/codex/mock-codex-cli'
import { ACTIVE_VIEWPORT } from '../feed-selectors'
import { openSessionByClick } from '../gestures'
import { sessionFeed } from '../page-trpc'
import { LONG_CLAUDE_BYTES, longCodexTurns } from './feed-pages.case'

// A wheel notch, and a fling a trackpad throws.
const WHEEL_PX = 120
const FLING_PX = 2_000
// How long the first row waits for an older page to come in before the Feed is taken as whole.
const OLDER_PAGE_WAIT_MS = 3_000

export type ScrollMeasure = {
  frames: number
  p50: number
  p95: number
  max: number
  over33: number
  over50: number
  jumps: { id: string; px: number; frame: number }[]
  gaps: number
  scrolledPx: number
}

// Every Session's transcript file the mock Claude wrote, by its file name.
async function transcriptFile(transcripts: string, nativeId: string): Promise<string> {
  for (const folder of await readdir(transcripts)) {
    const files = await readdir(path.join(transcripts, folder)).catch((): string[] => [])
    if (files.includes(`${nativeId}.jsonl`))
      return path.join(transcripts, folder, `${nativeId}.jsonl`)
  }
  throw new Error(`The mock Claude wrote no transcript for ${nativeId}.`)
}

// The history a long Argo-started Claude Session would have, written over its transcript while
// the app is closed.
export async function growClaudeSession(transcripts: string, project: string, nativeId: string) {
  await writeFile(
    await transcriptFile(transcripts, nativeId),
    buildHistory(project, LONG_CLAUDE_BYTES).text,
  )
}

type StoredThread = { id: string; turns: { id: string; items: { id: string }[] }[] }

// The Turns a long Argo-started Codex thread would have, written to the mock store while the app
// is closed.
export async function growCodexThread(root: string, threadId: string) {
  const file = mockCodexStateFile(root)
  const threads = JSON.parse(await readFile(file, 'utf8')) as StoredThread[]
  const thread = threads.find(({ id }) => id === threadId)
  const turn = thread?.turns[0]
  if (thread === undefined || turn === undefined)
    throw new Error(`The mock Codex store holds no Turn of ${threadId}.`)
  thread.turns = longCodexTurns(turn, `${threadId}-`)
  await writeFile(file, JSON.stringify(threads))
}

// Scrolls `step` px a frame toward `direction`'s end, waiting at the first row for older pages,
// and watches each frame: a row in view on two frames running must move by the scroll asked for.
function scrollMeasuring(page: Page, direction: 'start' | 'end', step: number) {
  return page.evaluate(
    async ({ selector, direction, step, olderWaitMs }) => {
      const viewport = document.querySelector<HTMLElement>(selector)
      if (viewport === null) throw new Error('No active Feed viewport.')
      const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))
      const rowTops = () => {
        const bounds = viewport.getBoundingClientRect()
        const tops = new Map<string, number>()
        let covered = 0
        for (const row of viewport.querySelectorAll<HTMLElement>('[data-feed-row]')) {
          const { top, bottom } = row.getBoundingClientRect()
          const shown = Math.min(bottom, bounds.bottom) - Math.max(top, bounds.top)
          if (shown > 0) covered += shown
          if (top >= bounds.top && bottom <= bounds.bottom) tops.set(row.dataset.feedRow ?? '', top)
        }
        return { tops, uncovered: bounds.height - covered }
      }
      const atEnd = () =>
        direction === 'start'
          ? viewport.scrollTop <= 0
          : viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1
      const deltas: number[] = []
      const jumps: { id: string; px: number; frame: number }[] = []
      let gaps = 0
      let scrolledPx = 0
      let waitedSince: number | null = null
      let last = await frame()
      let previous = rowTops()
      for (let index = 0; index < 20_000; index += 1) {
        const before = viewport.scrollTop
        if (!atEnd()) viewport.scrollBy(0, direction === 'start' ? -step : step)
        const asked = before - viewport.scrollTop
        scrolledPx += Math.abs(asked)
        const now = await frame()
        deltas.push(now - last)
        last = now
        const current = rowTops()
        // Padding at either end is less than half the viewport.
        if (current.uncovered > viewport.clientHeight / 2) gaps += 1
        for (const [id, top] of current.tops) {
          const was = previous.tops.get(id)
          if (was === undefined) continue
          const px = top - was - asked
          if (Math.abs(px) > 1) jumps.push({ id, px: Math.round(px), frame: index })
        }
        previous = current
        if (!atEnd()) waitedSince = null
        else if (direction === 'end') break
        else {
          waitedSince ??= now
          if (now - waitedSince > olderWaitMs) break
        }
      }
      deltas.sort((left, right) => left - right)
      const at = (share: number) =>
        Math.round(deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * share))] ?? 0)
      return {
        frames: deltas.length,
        p50: at(0.5),
        p95: at(0.95),
        max: Math.round(deltas.at(-1) ?? 0),
        over33: deltas.filter((delta) => delta > 33).length,
        over50: deltas.filter((delta) => delta > 50).length,
        jumps: jumps.slice(0, 10),
        gaps,
        scrolledPx,
      }
    },
    { selector: ACTIVE_VIEWPORT, direction, step, olderWaitMs: OLDER_PAGE_WAIT_MS },
  )
}

// Opens the Session, wheels to its first row through every older page, then flings back to the
// newest; no row in view may jump and the viewport may never be blank.
export async function proveSmoothScroll(
  page: Page,
  sessionId: string,
  label: string,
  testInfo: TestInfo,
) {
  await openSessionByClick(page, sessionId)
  await page.locator(`${ACTIVE_VIEWPORT} [data-feed-row]`).first().waitFor()
  const up = await scrollMeasuring(page, 'start', WHEEL_PX)
  expect((await sessionFeed(page, sessionId)).hasOlder, `${label} loads every page`).toBe(false)
  const down = await scrollMeasuring(page, 'end', FLING_PX)
  for (const [pass, measure] of [
    ['wheel to first row', up],
    ['fling to newest row', down],
  ] as const) {
    const { jumps: _jumps, ...timing } = measure
    testInfo.annotations.push({ type: `${label}: ${pass}`, description: JSON.stringify(timing) })
    console.info(`${label}: ${pass}`, JSON.stringify(measure))
    expect(measure.jumps, `${label}: ${pass} moves no row in view`).toEqual([])
    expect(measure.gaps, `${label}: ${pass} leaves no frame blank`).toBe(0)
  }
}
