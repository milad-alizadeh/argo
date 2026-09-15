// A fast scroll up the active Session's Feed and back down, the gesture that shows white gaps
// while rows mount (#2228). The gesture goes through Chromium's input pipeline, so the compositor
// scrolls the way it does under a trackpad, and nothing touches the real mouse.
import {
  copyTranscript,
  writeLongFeedTranscript,
} from '../../agents/claude/session-fake-driver/long-feed-transcript'
import { ACTIVE_VIEWPORT } from '../../core/sessions/fake-driver/feed-selectors'
import { openSessionByClick } from '../../core/sessions/fake-driver/session-gestures'
import type { Scenario, ScenarioRun } from './scenario'

const ROWS = '.feed__content > [data-index]'
// Under this there is too little history to outrun the overscan, and the reading means nothing.
const MINIMUM_RANGE_PX = 4000
const SETTLE_MS = 500
const STABLE_HEIGHT_MS = 1000
const PAUSE_BETWEEN_PASSES_MS = 300

async function scrollRange(run: ScenarioRun) {
  await run.page.waitForSelector(`${ACTIVE_VIEWPORT} ${ROWS}`, { timeout: 10_000 }).catch(() => {
    throw new Error('No Session Feed is open. Open a Session with a long history, then run again.')
  })
  // A Session's history arrives after its first rows, so the range is read once it stops growing.
  await run.page.waitForFunction(
    ({ selector, stableMs }) => {
      const height = document.querySelector(selector)?.scrollHeight ?? 0
      const seen = window.argoProfileHeight
      if (!seen || seen.height !== height) window.argoProfileHeight = { height, since: Date.now() }
      return Date.now() - window.argoProfileHeight.since >= stableMs
    },
    { selector: ACTIVE_VIEWPORT, stableMs: STABLE_HEIGHT_MS },
    { polling: 100, timeout: 20_000 },
  )
  return run.page.evaluate((selector) => {
    const viewport = document.querySelector(selector)
    const box = viewport.getBoundingClientRect()
    return {
      range: viewport.scrollHeight - viewport.clientHeight,
      scrollTop: viewport.scrollTop,
      x: Math.round(box.left + box.width / 2),
      y: Math.round(box.top + box.height / 2),
    }
  }, ACTIVE_VIEWPORT)
}

function setScrollTop(run: ScenarioRun, top: number) {
  return run.page.evaluate(
    ({ selector, top }) => {
      document.querySelector(selector).scrollTop = top
    },
    { selector: ACTIVE_VIEWPORT, top },
  )
}

async function gesture(run: ScenarioRun, point: { x: number; y: number }, distance: number) {
  // A positive distance scrolls up, toward older rows.
  await run.cdp.send('Input.synthesizeScrollGesture', {
    x: point.x,
    y: point.y,
    yDistance: distance,
    speed: run.options.speed,
    gestureSourceType: 'mouse',
  })
}

export const feedScroll: Scenario = {
  summary: 'Fast scroll up the active Session Feed and back down.',
  coverage: { viewport: ACTIVE_VIEWPORT, rows: ROWS },
  seedPackaged: (transcripts, options) =>
    options.transcript
      ? copyTranscript(transcripts, options.transcript)
      : writeLongFeedTranscript(transcripts, options.turns),
  async open(page, sessionId) {
    const row = `nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`
    await page.waitForSelector(row, { timeout: 10_000 }).catch(() => {
      throw new Error(`Session ${sessionId} is not in the Roster. Pick one the Roster lists.`)
    })
    await openSessionByClick(page, sessionId)
  },
  async prepare(run) {
    const start = await scrollRange(run)
    if (start.range < MINIMUM_RANGE_PX)
      throw new Error(
        `The open Feed scrolls only ${start.range}px. Open a Session with at least ${MINIMUM_RANGE_PX}px of history.`,
      )
    await setScrollTop(run, start.range)
    await run.page.waitForTimeout(SETTLE_MS)
    return () => setScrollTop(run, start.scrollTop)
  },
  async drive(run) {
    const { range, x, y } = await scrollRange(run)
    const distance = Math.min(range, run.options.distance)
    await gesture(run, { x, y }, distance)
    await run.page.waitForTimeout(PAUSE_BETWEEN_PASSES_MS)
    await gesture(run, { x, y }, -distance)
  },
}
