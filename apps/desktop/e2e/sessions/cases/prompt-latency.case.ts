// A new Session shows its prompt and its row while the slow Harness still holds the reply (#3039).
// The case releases the hold itself, so the check is an order, not a time.
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { chooseHarness, openNewSessionByClick, PERSISTED_ROW, sendFromComposer } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

const NEW_PROMPT = 'Say hello to a brand new Session.'
const EXISTING_PROMPT = 'Say hello again to this same Session.'
const FEED = 'section[aria-label="Session Feed"]'
// The unfixed pane sat blank for over 100 frames; one frame of Session List versus transcript skew is not a gap.
const MAX_BLANK_FRAMES = 3

type FeedWatch = { blankFrames: number; stopped: boolean }
type ObservedWindow = Window & { __feedWatch?: FeedWatch }

// Runs inside the page, so it names nothing outside itself. Counts the frames where the Feed is
// empty after it first held the prompt, until the case stops the watch.
function watchFeed({ feed, text }: { feed: string; text: string }) {
  const watch: FeedWatch = { blankFrames: 0, stopped: false }
  ;(window as ObservedWindow).__feedWatch = watch
  let shown = false
  const check = () => {
    if (watch.stopped) return
    const feedText = document.querySelector(feed)?.textContent ?? ''
    if (feedText.includes(text)) shown = true
    if (shown && feedText.trim() === '') watch.blankFrames += 1
    requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
}

async function sendWatched(page: Page, prompt: string) {
  await page.evaluate(watchFeed, { feed: FEED, text: prompt })
  await sendFromComposer(page, prompt)
  await page.locator(FEED).getByText(prompt).first().waitFor()
}

function stopWatch(page: Page) {
  return page.evaluate(() => {
    const watch = (window as ObservedWindow).__feedWatch
    if (watch === undefined) throw new Error('The Feed watch was never armed.')
    watch.stopped = true
    return watch.blankFrames
  })
}

export async function provePromptLatency(page: Page, backend: SessionHarnessBackend) {
  await openNewSessionByClick(page)
  await chooseHarness(page, 'claude')
  const created = { harness: 'claude' as const, prompt: NEW_PROMPT }
  await sendWatched(page, NEW_PROMPT)
  const row = page.locator(PERSISTED_ROW).filter({ hasText: NEW_PROMPT })
  await row.first().waitFor()
  // Both drew while the Harness still held its reply, so neither waited for it.
  assert.equal(await backend.recorded(created), false)
  await backend.waitForReply(page, created)
  assert.equal(await row.count(), 1)
  const createdBlankFrames = await stopWatch(page)

  // The first reply released the hold, so the existing Send checks blank frames only.
  await sendWatched(page, EXISTING_PROMPT)
  await backend.waitForReply(page, { harness: 'claude', prompt: EXISTING_PROMPT })
  const existingBlankFrames = await stopWatch(page)

  assert.ok(
    createdBlankFrames <= MAX_BLANK_FRAMES,
    `the Feed went blank for ${createdBlankFrames} frames while the new Session started`,
  )
  assert.ok(
    existingBlankFrames <= MAX_BLANK_FRAMES,
    `the Feed went blank for ${existingBlankFrames} frames after an existing Send`,
  )
}
