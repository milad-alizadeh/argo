// How long a Send takes to put the typed prompt on screen, for a new Session and an existing one (#2430).
// A slow Harness holds every reply back, so only the renderer's own optimistic draw can show the prompt.
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { chooseHarness, openNewSessionByClick } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

const NEW_PROMPT = 'Say hello to a brand new Session.'
const EXISTING_PROMPT = 'Say hello again to this same Session.'
// Far under the 3.5 s the blocked pane took, and loose enough for a loaded machine.
const PROMPT_BUDGET_MS = 1000
// The unfixed pane sat blank for over 100 frames; one frame of session-list-versus-transcript skew is not a gap.
const MAX_BLANK_FRAMES = 3
// Long enough to span the hand-off from the temporary id to the real Session.
const WATCH_MS = 2000

type PromptWatch = Promise<{ shownMs: number; blankFrames: number }>
type WatchedWindow = Window & { __promptWatch?: PromptWatch }

// Runs inside the page, so it names nothing outside itself. The clock starts on the Enter keydown
// and stops at the first frame that holds the prompt. Frames where the Feed is empty are then
// counted while the temporary id hands over to the real Session.
function watchAfterEnter({ text, watchMs }: { text: string; watchMs: number }) {
  let resolveWatch: (result: { shownMs: number; blankFrames: number }) => void = () => {}
  ;(window as WatchedWindow).__promptWatch = new Promise((resolve) => {
    resolveWatch = resolve
  })
  let started = 0
  let shownMs: number | null = null
  let blankFrames = 0
  const check = () => {
    const feedText = document.querySelector('section[aria-label="Session Feed"]')?.textContent ?? ''
    if (shownMs === null && feedText.includes(text)) shownMs = performance.now() - started
    if (shownMs !== null && feedText.trim() === '') blankFrames += 1
    if (shownMs !== null && performance.now() - started > watchMs)
      resolveWatch({ shownMs, blankFrames })
    else requestAnimationFrame(check)
  }
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    window.removeEventListener('keydown', onKeydown, { capture: true })
    started = performance.now()
    check()
  }
  window.addEventListener('keydown', onKeydown, { capture: true })
}

async function armWatch(page: Page, prompt: string) {
  await page.evaluate(watchAfterEnter, { text: prompt, watchMs: WATCH_MS })
}

async function sendWatched(page: Page, prompt: string) {
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(prompt)
  await armWatch(page, prompt)
  await page.keyboard.press('Enter')
  return page.evaluate(() => {
    const watch = (window as WatchedWindow).__promptWatch
    if (watch === undefined) throw new Error('The prompt watch was never armed.')
    return watch
  })
}

export async function provePromptLatency(page: Page, backend: SessionHarnessBackend) {
  await openNewSessionByClick(page)
  await chooseHarness(page, 'claude')
  const created = await sendWatched(page, NEW_PROMPT)
  // The header names the Session by its prompt, never by its temporary id.
  const header = page.getByRole('heading', { level: 1 })
  assert.doesNotMatch((await header.textContent()) ?? '', /optimistic:/)
  await backend.waitForReply(page, { harness: 'claude', prompt: NEW_PROMPT })

  const existing = await sendWatched(page, EXISTING_PROMPT)
  await backend.waitForReply(page, { harness: 'claude', prompt: EXISTING_PROMPT })

  console.log(
    `[prompt-latency] new=${created.shownMs.toFixed(1)}ms existing=${existing.shownMs.toFixed(1)}ms`,
  )
  assert.ok(created.shownMs < PROMPT_BUDGET_MS, `new Session took ${created.shownMs}ms`)
  assert.ok(existing.shownMs < PROMPT_BUDGET_MS, `existing Session took ${existing.shownMs}ms`)
  assert.ok(
    created.blankFrames <= MAX_BLANK_FRAMES,
    `the Feed went blank for ${created.blankFrames} frames while the new Session started`,
  )
  assert.ok(
    existing.blankFrames <= MAX_BLANK_FRAMES,
    `the Feed went blank for ${existing.blankFrames} frames after an existing Send`,
  )
}
