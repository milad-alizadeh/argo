// The reading half of the packaged Session proof: what a reader sees on a first open, that a Feed
// never carries one Session's rows under another's name, and the renderer authority the Session
// bridge asserts for itself.
import assert from 'node:assert/strict'
import { listing, openSession } from './session-roster-cases'

// The three things a reader does with a Feed on the first open: it stands at the tail, it says
// which Session it is showing, and its prose can be selected with a mouse.
export async function proveFirstOpen(page) {
  await openSession(page, 'read this file', 'prose')
  const reading = await page.evaluate(() => {
    const viewport = document.querySelector('.feed__viewport')
    const prose = document.querySelector('.feed__viewport .feed-row--prose')
    const range = document.createRange()
    range.selectNodeContents(prose)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
    return {
      session: viewport.dataset.session,
      overflows: viewport.scrollHeight > viewport.clientHeight,
      fromTail: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
      userSelect: getComputedStyle(prose).userSelect,
      selected: window.getSelection().toString(),
      measureMs: Number(
        document.querySelector('.feed__document[data-active="true"]').dataset.measureMs,
      ),
      settleMs: Number(
        document.querySelector('.feed__document[data-active="true"]').dataset.settleMs,
      ),
    }
  })
  assert.equal(reading.session, 'prose')
  assert.equal(reading.overflows, true)
  // The tail, within a pixel of rounding. A Feed that opened anywhere else has lost the reader's
  // place before they have read a word.
  assert.equal(reading.fromTail <= 1, true)
  assert.notEqual(reading.userSelect, 'none')
  assert.equal(reading.selected.length > 0, true)
  return reading
}

export async function proveCodexFeed(page) {
  // The button reads the Session's title, which falls back to its first prompt when nothing
  // named it (CONTEXT.md · Session title): the fixture's opening line, not its id.
  await openSession(page, 'Run Codex check', 'rollout-codexParent')
  await page.waitForFunction(() =>
    document
      .querySelector('[aria-label="Session history"]')
      ?.textContent?.includes('Run Codex check'),
  )
  const reading = await page.evaluate(() => {
    const prose = document.querySelector('[aria-label="Session history"] .feed-row--prose')
    const range = document.createRange()
    if (prose !== null) range.selectNodeContents(prose)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
    return {
      text: prose?.textContent,
      userSelect: prose === null ? '' : getComputedStyle(prose).userSelect,
    }
  })
  assert.equal(reading.text?.includes('Run Codex check'), true)
  assert.notEqual(reading.userSelect, 'none')
}

// Every animation frame from now until the Feed has stood on `target` for a few of them. The
// renderer reaches a commit carrying a newly chosen Session's rows before the effects behind them
// have run, so a frame-by-frame sample across a switch is the only place that window is visible.
function watchFrames(page, target) {
  return page.evaluate(
    (name) =>
      new Promise((settle) => {
        const samples = []
        const read = () => {
          const viewport = document.querySelector('.feed__viewport')
          const row = viewport?.querySelector('[data-feed-row]')
          if (viewport && row) {
            samples.push({
              session: viewport.dataset.session,
              row: row.dataset.feedRow,
              stated: row.style.height,
            })
          }
          if (samples.filter((sample) => sample.session === name).length > 8) return settle(samples)
          requestAnimationFrame(read)
        }
        read()
      }),
    target,
  )
}

// A switch must never draw one Session's rows under another Session's name. Both Sessions here
// have been read already, so this is the fast switch: the reply and the reading are both on hand
// and the whole thing lands in one flush.
export async function proveNoMislabelledFeed(page) {
  await openSession(page, 'Pick the ink', 'askPending')
  const watching = watchFrames(page, 'unparseableBody')
  await page.click('button:has-text("unparseableBody")')
  const samples = await watching
  assert.equal(samples.length > 0, true)
  assert.deepEqual(
    samples.filter(
      (sample) => (sample.session === 'unparseableBody') !== sample.row.startsWith('unreadable:'),
    ),
    [],
  )
}

// And must never draw a row against a reading taken of a different document — a row with no stated
// height, laid out by Blink rather than by the pass (ADR-0033). The Session opened here is opened
// for the FIRST time in this run, so a real measure pass stands between the choice and the draw
// and the window is frames wide rather than instants; a Session already measured answers from the
// cache inside one flush and leaves nothing to sample.
//
// What this gates, measured rather than assumed: two guards hold the window shut — the renderer's
// `shown`, which keeps rows and the chosen id travelling together, and `useSettledFeed`'s own
// `settledHere`. Removing either alone leaves the proof green, and removing both turns this case
// red. It is the pair that is asserted here, not one of them.
export async function proveNoUnmeasuredRow(page) {
  await openSession(page, 'Pick the ink', 'askPending')
  const watching = watchFrames(page, 'resumeParent')
  await page.click('button:has-text("Start the parent work")')
  const samples = await watching
  assert.equal(
    samples.some((sample) => sample.session === 'resumeParent'),
    true,
  )
  assert.deepEqual(
    samples.filter((sample) => sample.stated === ''),
    [],
  )
}

// The Session bridge asserts its own renderer authority, so it is proved rather than inherited
// from the Project bridge beside it: a page that navigated away holds no Session.
export async function proveRendererAuthority(page, application) {
  await application.evaluate(async ({ BrowserWindow }) => {
    await BrowserWindow.getAllWindows()[0].loadURL('data:text/html,<h1>Untrusted page</h1>')
  })
  await page.waitForFunction(() => typeof window.argo?.listSessions === 'function')
  const reply = await page.evaluate((value) => window.argo.listSessions(value), listing)
  assert.equal(reply.code, 'access-denied')
}
