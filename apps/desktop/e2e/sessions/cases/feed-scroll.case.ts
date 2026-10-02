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

// A fast trackpad's wheel event, and a fling it throws.
const WHEEL_PX = 600
const FLING_PX = 2_000
// Past the height of every row of the longest Feed here, a notch at a time.
const MAX_WHEEL_NOTCHES = 20_000
// How often the wheel looks whether it reached the first row.
const NOTCHES_PER_CHECK = 10

export type ScrollMeasure = {
  frames: number
  p50: number
  p95: number
  max: number
  over33: number
  over50: number
  jumps: string[]
  gaps: number
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

type FeedScrollWindow = {
  feedScrollSample: () => { blank: boolean; jump: string | null }
  feedScrollRecord: { deltas: number[]; jumps: string[]; gaps: number; stopped: boolean }
}

// Installs a sample of the rows wholly in view: whether the viewport is mostly blank, and how they
// moved since the sample before. Rows that stay in view must move by the wheel alone.
function installRowSampler(page: Page, selector: string) {
  return page.evaluate((selector) => {
    const viewport = document.querySelector<HTMLElement>(selector)
    if (viewport === null) throw new Error('No active Feed viewport.')
    const rows = () => {
      const bounds = viewport.getBoundingClientRect()
      const tops = new Map<string, number>()
      let covered = 0
      for (const row of viewport.querySelectorAll<HTMLElement>('[data-feed-row]')) {
        const { top, bottom } = row.getBoundingClientRect()
        covered += Math.max(0, Math.min(bottom, bounds.bottom) - Math.max(top, bounds.top))
        if (top >= bounds.top && bottom <= bounds.bottom) tops.set(row.dataset.feedRow ?? '', top)
      }
      // At either end the scroll stops short of what the wheel asked.
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const pinned = scrollTop <= 0 || scrollTop >= scrollHeight - clientHeight - 1
      return { tops, blank: bounds.height - covered > bounds.height / 2, scrollTop, pinned }
    }
    // Pixels the wheel asked for that rows have not moved yet; a scroll may spread them over frames.
    let wheeled = 0
    viewport.addEventListener('wheel', (event) => (wheeled -= event.deltaY), { passive: true })
    const spend = (moved: number) => {
      wheeled = wheeled > 0 ? Math.max(0, wheeled - moved) : Math.min(0, wheeled - moved)
    }
    // Rows in view move together, and only as far as the wheel asked; past it, content moved them.
    const judge = (before: ReturnType<typeof rows>, after: ReturnType<typeof rows>) => {
      const moves = [...after.tops].flatMap(([id, top]) => {
        const was = before.tops.get(id)
        return was === undefined ? [] : [{ id, move: top - was }]
      })
      const [first] = moves
      // A scroll past every row in view leaves none to judge by; it spent what the scroll moved.
      if (first === undefined) {
        spend(before.scrollTop - after.scrollTop)
        return null
      }
      const apart = moves.find(({ move }) => Math.abs(move - first.move) > 1)
      if (apart !== undefined)
        return `${apart.id} moved ${Math.round(apart.move - first.move)}px apart`
      const asked = wheeled
      const past = first.move * Math.sign(asked) < -1 || Math.abs(first.move) > Math.abs(asked) + 1
      if (after.pinned) wheeled = 0
      else spend(first.move)
      return past
        ? `${first.id} moved ${Math.round(first.move)}px, ${Math.round(asked)}px wheeled`
        : null
    }
    let previous = rows()
    ;(window as unknown as FeedScrollWindow).feedScrollSample = () => {
      const current = rows()
      const jump = judge(previous, current)
      previous = current
      return { blank: current.blank, jump }
    }
  }, selector)
}

// Records every frame until stopped: the gap between frames, and the row sample after it paints.
async function startFrameRecorder(page: Page, selector: string) {
  await installRowSampler(page, selector)
  await page.evaluate(() => {
    const probe = window as unknown as FeedScrollWindow
    const record = { deltas: [] as number[], jumps: [] as string[], gaps: 0, stopped: false }
    let last = performance.now()
    // Rows are read in a task posted from the frame, which runs after it paints: inside the
    // frame callback, rows the scroll just mounted still stand at their estimated height.
    const painted = new MessageChannel()
    painted.port1.onmessage = () => {
      const { blank, jump } = probe.feedScrollSample()
      if (blank) record.gaps += 1
      if (jump !== null) record.jumps.push(jump)
    }
    const tick = (now: number) => {
      if (record.stopped) return
      record.deltas.push(now - last)
      last = now
      painted.port2.postMessage(null)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    probe.feedScrollRecord = record
  })
}

async function stopFrameRecorder(page: Page): Promise<ScrollMeasure> {
  const { deltas, jumps, gaps } = await page.evaluate(() => {
    const record = (window as unknown as FeedScrollWindow).feedScrollRecord
    record.stopped = true
    return record
  })
  const sorted = [...deltas].sort((left, right) => left - right)
  const at = (share: number) =>
    Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0)
  return {
    frames: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    max: Math.round(sorted.at(-1) ?? 0),
    over33: sorted.filter((delta) => delta > 33).length,
    over50: sorted.filter((delta) => delta > 50).length,
    jumps: jumps.slice(0, 10),
    gaps,
  }
}

const viewportScroll = (page: Page, selector: string) =>
  page.$eval(selector, (viewport) => ({
    top: viewport.scrollTop,
    atEnd: viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1,
  }))

// Wheels toward the first row through Chromium's own input, waiting there for each older page.
async function wheelToStart(page: Page, sessionId: string, selector: string) {
  for (let notches = 0; notches < MAX_WHEEL_NOTCHES; notches += 1) {
    await page.mouse.wheel(0, -WHEEL_PX)
    if (notches % NOTCHES_PER_CHECK !== 0 || (await viewportScroll(page, selector)).top > 0)
      continue
    if (!(await sessionFeed(page, sessionId)).hasOlder) return
    await expect.poll(async () => (await viewportScroll(page, selector)).top).toBeGreaterThan(0)
  }
  throw new Error(`The Feed never reached its first row in ${MAX_WHEEL_NOTCHES} notches.`)
}

async function flingToEnd(page: Page, selector: string) {
  for (let flings = 0; flings < MAX_WHEEL_NOTCHES; flings += 1) {
    await page.mouse.wheel(0, FLING_PX)
    if ((await viewportScroll(page, selector)).atEnd) return
  }
  throw new Error('The Feed never reached its newest row.')
}

// Opens the Session, wheels to its first row through every older page, then flings back to the
// newest; no row in view may jump and the viewport may never be blank.
export async function proveSmoothScroll(
  page: Page,
  session: { sessionId: string; label: string },
  testInfo: TestInfo,
) {
  const { sessionId, label } = session
  await openSessionByClick(page, sessionId)
  const selector = `${ACTIVE_VIEWPORT}[data-session="${sessionId}"]`
  const viewport = page.locator(selector)
  await viewport.locator('[data-feed-row]').first().waitFor()
  const box = await viewport.boundingBox()
  if (box === null) throw new Error('The Feed viewport has no box.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await startFrameRecorder(page, selector)
  await wheelToStart(page, sessionId, selector)
  const up = await stopFrameRecorder(page)
  await startFrameRecorder(page, selector)
  await flingToEnd(page, selector)
  const down = await stopFrameRecorder(page)
  for (const [pass, measure] of [
    ['wheel to first row', up],
    ['fling to newest row', down],
  ] as const) {
    const { jumps: _jumps, ...timing } = measure
    testInfo.annotations.push({ type: `${label}: ${pass}`, description: JSON.stringify(timing) })
    console.info(`${label}: ${pass}`, JSON.stringify(measure))
    expect(measure.jumps, `${label}: ${pass} moves no row in view on its own`).toEqual([])
    expect(measure.gaps, `${label}: ${pass} leaves no frame blank`).toBe(0)
  }
}
