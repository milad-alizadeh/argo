// Scrolling a long Feed from its newest row to its first and back is smooth: rows in view move
// only by the scroll the reader asked for, the viewport is never left blank, and frames are timed,
// for Claude and Codex alike, Argo-started and outside (#3151).
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, type TestInfo } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { Harness } from '@/harnesses/harness'
import { buildHistory } from '../../../mocks/cli/claude/long-claude-history'
import { mockCodexStateFile } from '../../../mocks/cli/codex/mock-codex-cli'
import { ACTIVE_VIEWPORT } from '../feed-selectors'
import { openSessionByClick, sendFromComposer } from '../gestures'
import type { PackagedSession } from '../packaged-session-harness'
import { sessionFeed } from '../page-trpc'
import {
  longCodexTurns,
  type StoredThread,
  writeLongClaudeSession,
  writeLongCodexThread,
} from './feed-pages.case'

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
  // Frames in which the content's height changed: a row grew or arrived.
  grew: number
}

// About five pages of Claude history: every page is wheeled through well inside a test's timeout.
const SCROLL_CLAUDE_BYTES = 1_300_000

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
async function growClaudeSession(transcripts: string, project: string, nativeId: string) {
  await writeFile(
    await transcriptFile(transcripts, nativeId),
    buildHistory(project, SCROLL_CLAUDE_BYTES).text,
  )
}

// The Turns a long Argo-started Codex thread would have, written to the mock store while the app
// is closed.
async function growCodexThread(root: string, threadId: string) {
  const file = mockCodexStateFile(root)
  const threads = JSON.parse(await readFile(file, 'utf8')) as StoredThread[]
  const thread = threads.find(({ id }) => id === threadId)
  const turn = thread?.turns[0]
  if (thread === undefined || turn === undefined)
    throw new Error(`The mock Codex store holds no Turn of ${threadId}.`)
  thread.turns = longCodexTurns(turn, `${threadId}-`)
  await writeFile(file, JSON.stringify(threads))
}

// Grows a Session Argo started into a long one, while the app is closed.
export function growStartedSession(session: PackagedSession, harness: Harness, nativeId: string) {
  const { claudeTranscripts, project } = session.fixture
  const grow = {
    claude: () => growClaudeSession(claudeTranscripts, project, nativeId),
    codex: () => growCodexThread(session.root, nativeId),
  }
  return grow[harness]()
}

// Writes a long Session started outside Argo, while the app is closed, and answers its native id.
export async function writeOutsideSession(session: PackagedSession, harness: Harness) {
  const { claudeTranscripts, project } = session.fixture
  const write = {
    claude: async () =>
      (await writeLongClaudeSession(claudeTranscripts, project, SCROLL_CLAUDE_BYTES)).nativeId,
    codex: () => writeLongCodexThread(session.root),
  }
  return write[harness]()
}

// What happened between two samples: a wheel event, every row in view gone, the rows in view
// moving apart from each other, or all of them moving together, `moved` px down. `room` is how far
// the scroll could go up and down before the frame.
type Room = { above: number; below: number }
type Motion =
  | { asked: number }
  | { lost: number; room: Room }
  | { apart: string }
  | { moved: number; label: string; room: Room }

type FeedScrollWindow = {
  feedScrollSample: () => boolean
  feedScrollWheel?: AbortController
  feedScrollMotion: Motion[]
  feedScrollRecord: { deltas: number[]; gaps: number; grew: number; stopped: boolean }
}

// Records each wheel event among the samples.
function installWheelRecorder(page: Page, selector: string) {
  return page.evaluate((selector) => {
    const viewport = document.querySelector<HTMLElement>(selector)
    if (viewport === null) throw new Error('No active Feed viewport.')
    const probe = window as unknown as FeedScrollWindow
    const motion: Motion[] = []
    probe.feedScrollMotion = motion
    probe.feedScrollWheel?.abort()
    probe.feedScrollWheel = new AbortController()
    const onWheel = (event: WheelEvent) => motion.push({ asked: -event.deltaY })
    viewport.addEventListener('wheel', onWheel, {
      passive: true,
      signal: probe.feedScrollWheel.signal,
    })
  }, selector)
}

// Installs a sample of the rows wholly in view, which answers whether the viewport is mostly blank
// and records how they moved since the sample before.
async function installRowSampler(page: Page, selector: string) {
  await installWheelRecorder(page, selector)
  await page.evaluate((selector) => {
    const viewport = document.querySelector<HTMLElement>(selector)
    if (viewport === null) throw new Error('No active Feed viewport.')
    const probe = window as unknown as FeedScrollWindow
    // Rows wholly in view by their tops, and the edges of every row drawn and of those in view.
    const rows = () => {
      const bounds = viewport.getBoundingClientRect()
      const tops = new Map<string, number>()
      const edges = new Map<string, number>()
      let covered = 0
      for (const row of viewport.querySelectorAll<HTMLElement>('[data-feed-row]')) {
        const { top, bottom } = row.getBoundingClientRect()
        const id = row.dataset.feedRow ?? ''
        covered += Math.max(0, Math.min(bottom, bounds.bottom) - Math.max(top, bounds.top))
        edges.set(`${id} top`, top).set(`${id} bottom`, bottom)
        if (top >= bounds.top && bottom <= bounds.bottom) tops.set(id, top)
      }
      const seen = new Map([...edges].filter(([, at]) => at >= bounds.top && at <= bounds.bottom))
      const blank = bounds.height - covered > bounds.height / 2
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const room = { above: scrollTop, below: scrollHeight - clientHeight - scrollTop }
      return { tops, edges, seen, blank, scrollTop, room }
    }
    const movesFrom = (was: Map<string, number>, now: Map<string, number>) =>
      [...now].flatMap(([id, top]) => {
        const before = was.get(id)
        return before === undefined ? [] : [{ id, move: top - before }]
      })
    const step = (before: ReturnType<typeof rows>, after: ReturnType<typeof rows>): Motion => {
      const moves = movesFrom(before.tops, after.tops)
      const [first] = moves
      if (first !== undefined) {
        const apart = moves.find(({ move }) => Math.abs(move - first.move) > 1)
        if (apart !== undefined)
          return { apart: `${apart.id} moved ${Math.round(apart.move - first.move)}px apart` }
        return { moved: first.move, label: first.id, room: before.room }
      }
      // A scroll past every row in view, or a row taller than the view, is read by the row edges in
      // view that were drawn before, if they agree; a row out of view may change size meanwhile.
      const [edge, ...others] = movesFrom(before.edges, after.seen)
      if (edge === undefined || others.some(({ move }) => Math.abs(move - edge.move) > 1))
        return { lost: before.scrollTop - after.scrollTop, room: before.room }
      return { moved: edge.move, label: edge.id, room: before.room }
    }
    let previous = rows()
    let earlier = previous.room
    probe.feedScrollSample = () => {
      const current = rows()
      const motion = step(previous, current)
      // The compositor can still scroll from where it stood before a page landed.
      if ('room' in motion)
        motion.room = {
          above: Math.min(motion.room.above, earlier.above),
          below: Math.min(motion.room.below, earlier.below),
        }
      probe.feedScrollMotion.push(motion)
      earlier = previous.room
      previous = current
      return current.blank
    }
  }, selector)
}

// Wheel events rows may lag or lead by: Chromium can paint a notch's scroll frames before or after
// the page receives its wheel event.
const WHEEL_LEAD_EVENTS = 3
const WHEEL_SLACK_PX = 2

// Rows in view move together, never against the wheel, and never run ahead of it or fall short of
// it for more than a few wheel events. Rows stopping short at an end are not jumps.
function wheelJumps(motion: readonly Motion[]): string[] {
  const jumps: string[] = []
  // Rows moved minus what the wheel asked, and the wheel events it stayed off 0 for.
  let drift = 0
  let off = 0
  let direction = 0
  const ahead = () => (direction === 0 ? Math.abs(drift) : drift * direction)
  const frame = (moved: number, room: Room) => {
    drift += moved
    const along = moved * direction
    // The scroll used all the room to an end, or had none, short of the wheel.
    const left = direction > 0 ? room.above : room.below
    if (ahead() < 0 && along >= 0 && along >= left - WHEEL_SLACK_PX) drift = 0
    if (along < -WHEEL_SLACK_PX) jumps.push(`rows moved ${Math.round(moved)}px against the wheel`)
    if (Math.abs(drift) <= WHEEL_SLACK_PX) off = 0
  }
  const ask = (asked: number) => {
    direction = Math.sign(asked)
    const lead = ahead()
    drift -= asked
    if (Math.abs(drift) > WHEEL_SLACK_PX) off += 1
    if (off <= WHEEL_LEAD_EVENTS) return
    if (Math.abs(lead) > WHEEL_SLACK_PX)
      jumps.push(`rows ran ${Math.round(lead)}px off the wheel for ${off} wheel events`)
    drift = -asked
    off = 1
  }
  for (const step of motion) {
    if ('asked' in step) ask(step.asked)
    else if ('apart' in step) {
      jumps.push(step.apart)
      drift = 0
    }
    // A page landing moves the scroll against the wheel, and leaves no row to judge by.
    else if ('lost' in step && step.lost * direction < 0) drift = 0
    else frame('lost' in step ? step.lost : step.moved, step.room)
  }
  if (Math.abs(ahead()) > WHEEL_SLACK_PX)
    jumps.push(`rows ended ${Math.round(ahead())}px off the wheel`)
  return jumps
}

// Records every frame until stopped: the gap between frames, and the row sample after it paints.
async function startFrameRecorder(page: Page, selector: string) {
  await installRowSampler(page, selector)
  await page.evaluate((selector) => {
    const viewport = document.querySelector<HTMLElement>(selector)
    if (viewport === null) throw new Error('No active Feed viewport.')
    const probe = window as unknown as FeedScrollWindow
    const record = { deltas: [] as number[], gaps: 0, grew: 0, stopped: false }
    let height = viewport.scrollHeight
    let last = performance.now()
    // Rows are read in a task posted from the frame, which runs after it paints: inside the
    // frame callback, rows the scroll just mounted still stand at their estimated height.
    const painted = new MessageChannel()
    painted.port1.onmessage = () => {
      if (probe.feedScrollSample()) record.gaps += 1
      if (viewport.scrollHeight !== height) record.grew += 1
      height = viewport.scrollHeight
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
  }, selector)
}

// Long enough after the last wheel event for its scroll to land.
const WHEEL_SETTLE_MS = 500

async function stopFrameRecorder(page: Page): Promise<ScrollMeasure> {
  await page.waitForTimeout(WHEEL_SETTLE_MS)
  const { deltas, gaps, grew, motion } = await page.evaluate(() => {
    const probe = window as unknown as FeedScrollWindow
    probe.feedScrollRecord.stopped = true
    probe.feedScrollWheel?.abort()
    return { ...probe.feedScrollRecord, motion: probe.feedScrollMotion }
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
    jumps: wheelJumps(motion).slice(0, 10),
    gaps,
    grew,
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
  ] as const)
    expectSmooth(`${label}: ${pass}`, measure, testInfo)
}

// Annotates the pass's timing and asserts no row in view moved on its own and no frame was blank.
function expectSmooth(pass: string, measure: ScrollMeasure, testInfo: TestInfo) {
  const { jumps: _jumps, ...timing } = measure
  testInfo.annotations.push({ type: pass, description: JSON.stringify(timing) })
  console.info(pass, JSON.stringify(measure))
  expect(measure.jumps, `${pass} moves no row in view on its own`).toEqual([])
  expect(measure.gaps, `${pass} leaves no frame blank`).toBe(0)
}

// The first row wholly in view and its offset from the viewport's top.
function readerPlace(page: Page, selector: string) {
  return page.$eval(selector, (viewport) => {
    const { top, height } = viewport.getBoundingClientRect()
    for (const row of viewport.querySelectorAll<HTMLElement>('[data-feed-row]')) {
      const offset = row.getBoundingClientRect().top - top
      if (offset >= 0 && offset < height)
        return { id: row.dataset.feedRow ?? '', offset: Math.round(offset) }
    }
    throw new Error('No Feed row is in view.')
  })
}

const atTail = (page: Page, selector: string) =>
  expect.poll(async () => (await viewportScroll(page, selector)).atEnd).toBe(true)

// Opens the Session at its tail, scrolls to its first row so the page before it loads, and opens
// `otherId` `delay` ms later, with that page still loading or just landed. Opened again, the
// Session shows the row the reader left where it was, and holds the page before it.
export async function proveReturnKeepsPlace(
  page: Page,
  session: { sessionId: string; otherId: string; delay: number; label: string },
) {
  const { sessionId, otherId, delay, label } = session
  const selector = `${ACTIVE_VIEWPORT}[data-session="${sessionId}"]`
  await openSessionByClick(page, sessionId)
  await page.locator(`${selector} [data-feed-row]`).first().waitFor()
  await atTail(page, selector)
  expect((await sessionFeed(page, sessionId)).hasOlder, `${label}: opens on one page`).toBe(true)
  // The rows the scroll reaches have painted after two frames.
  await page.$eval(selector, async (viewport) => {
    viewport.scrollTop = 0
    for (let frame = 0; frame < 2; frame += 1)
      await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  await page.waitForTimeout(delay)
  const left = await readerPlace(page, selector)
  await openSessionByClick(page, otherId)
  await page.waitForTimeout(2_000)
  await openSessionByClick(page, sessionId)
  await page.locator(`${selector} [data-feed-row]`).first().waitFor()
  await expect
    .poll(() => readerPlace(page, selector).catch(() => null), {
      message: `${label}: the reader is back on the row they left`,
    })
    .toEqual(left)
  expect((await sessionFeed(page, sessionId)).hasOlder, `${label}: the older page is loaded`).toBe(
    false,
  )
}

// Home, End and Home again from the keyboard, each given time to settle: the last Home, with every
// page loaded, ends on the Session's first row.
export async function proveHomeReachesFirstRow(
  page: Page,
  session: { sessionId: string; label: string },
) {
  const { sessionId, label } = session
  const selector = `${ACTIVE_VIEWPORT}[data-session="${sessionId}"]`
  await openSessionByClick(page, sessionId)
  await page.locator(`${selector} [data-feed-row]`).first().waitFor()
  await atTail(page, selector)
  await page.$eval(selector, (viewport) => (viewport as HTMLElement).focus())
  for (const key of ['Home', 'End', 'Home']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(2_500)
  }
  expect((await sessionFeed(page, sessionId)).hasOlder, `${label}: Home loaded every page`).toBe(
    false,
  )
  expect((await viewportScroll(page, selector)).top, `${label}: Home ends on the first row`).toBe(0)
}

// A reader's slow wheel through history, a notch at a time.
const READING_WHEEL_PX = 40
const READING_NOTCHES = 60
const READING_NOTCH_MS = 25
// Far enough above the tail that the streaming reply is out of view.
const HISTORY_DEPTH_PX = 4_000
// Close enough to the first loaded row that the slow wheel asks for the page before it.
const NEAR_START_PX = 400
// While the reply is held, the mock adds rounds of rows at the tail.
const STREAM_PROMPT = 'FeedRoundsProbe: keep working while I read history.'
// Rows the test's jump into history mounted settle at their measured heights before the wheel.
const JUMP_SETTLE_MS = 300
// The pin that scrolls a sent prompt to the top runs smoothly; the reader moves after it.
const PIN_SETTLE_MS = 1_000

async function readSlowly(page: Page) {
  for (let notch = 0; notch < READING_NOTCHES; notch += 1) {
    await page.mouse.wheel(0, -READING_WHEEL_PX)
    await page.waitForTimeout(READING_NOTCH_MS)
  }
}

async function measureReading(page: Page, selector: string) {
  await page.waitForTimeout(JUMP_SETTLE_MS)
  await startFrameRecorder(page, selector)
  await readSlowly(page)
  return stopFrameRecorder(page)
}

// While a held reply streams at the tail, a reader wheeling slowly through history, and then into
// an older page, sees the rows in view move only by the wheel (#3151).
export async function proveStillWhileStreaming(
  page: Page,
  session: { sessionId: string; label: string; release: () => Promise<void> },
  testInfo: TestInfo,
) {
  const { sessionId, label, release } = session
  await openSessionByClick(page, sessionId)
  const selector = `${ACTIVE_VIEWPORT}[data-session="${sessionId}"]`
  const viewport = page.locator(selector)
  await viewport.locator('[data-feed-row]').first().waitFor()
  await sendFromComposer(page, STREAM_PROMPT)
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.textContent?.includes('Round 3 is done.'),
    selector,
  )
  await page.waitForTimeout(PIN_SETTLE_MS)
  const box = await viewport.boundingBox()
  if (box === null) throw new Error('The Feed viewport has no box.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  await viewport.evaluate((element, depth) => {
    element.scrollTop = element.scrollHeight - element.clientHeight - depth
  }, HISTORY_DEPTH_PX)
  const reading = await measureReading(page, selector)

  const loaded = (await sessionFeed(page, sessionId)).entries.length
  await viewport.evaluate((element, near) => {
    element.scrollTop = element.clientHeight + near
  }, NEAR_START_PX)
  const older = await measureReading(page, selector)
  const after = (await sessionFeed(page, sessionId)).entries.length
  await release()

  for (const [pass, measure] of [
    ['read history while streaming', reading],
    ['load an older page while streaming', older],
  ] as const) {
    expectSmooth(`${label}: ${pass}`, measure, testInfo)
    expect(measure.grew, `${label}: ${pass} ran while the tail grew`).toBeGreaterThan(0)
  }
  expect(after, `${label}: an older page came in while streaming`).toBeGreaterThan(loaded)
}
