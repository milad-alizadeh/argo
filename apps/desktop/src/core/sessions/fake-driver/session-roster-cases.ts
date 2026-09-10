// The Roster half of the packaged Session proof: what the list says before a reader has chosen
// anything, and what choosing does. The driver owns the app copy, the launch and the order.
import assert from 'node:assert/strict'

// The listing request itself, shared with the authority case: the same call has to be refused
// from a page that navigated away, and two spellings of it would prove two different things.
export const listing = { version: 1, type: 'session.list', requestId: 'list-1' }
const feed = { version: 1, type: 'session.feed', requestId: 'feed-1', sessionId: 'resumeChild' }
const codexFeed = {
  version: 1,
  type: 'session.feed',
  requestId: 'codex-feed-1',
  sessionId: 'rollout-codexChild',
}

export async function proveContract(page) {
  const list = await page.evaluate((value) => window.argo.listSessions(value), listing)
  assert.equal(list.type, 'session.listed')
  assert.deepEqual({ found: list.filesFound, read: list.filesRead }, { found: 9, read: 9 })
  // Seven Sessions from nine files, discovered without one registered Project.
  assert.deepEqual(list.sessions.map((session) => session.id).sort(), [
    'askPending',
    'externalBasic',
    'rollout-codexParent',
    'prose',
    'resumeParent',
    'strandedResume',
    'unparseableBody',
  ])
  // The chain that reaches its own origin is not partial; the one whose origin is in no file here
  // is, and only it.
  assert.deepEqual(
    list.sessions.filter((session) => session.originUnread).map((session) => session.id),
    ['strandedResume'],
  )
  assert.deepEqual([...new Set(list.sessions.map((session) => session.posture))], ['external'])
  // A retired id follows the chain that took it rather than reading as a Session that ended.
  const read = await page.evaluate((value) => window.argo.readSessionFeed(value), feed)
  assert.equal(read.chainId, 'resumeParent')
  assert.equal(read.rows.length, 4)
  const codexRead = await page.evaluate((value) => window.argo.readSessionFeed(value), codexFeed)
  assert.equal(codexRead.chainId, 'rollout-codexParent')
  assert.equal(codexRead.rows.length, 4)
  const missing = await page.evaluate((value) => window.argo.readSessionFeed(value), {
    ...feed,
    sessionId: 'not-a-session',
  })
  assert.equal(missing.code, 'missing-session')
}

export function readRoster(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('nav[aria-label="Sessions"] button')]
    return {
      count: buttons.length,
      selected: buttons.filter((button) => button.getAttribute('aria-current') === 'true').length,
      reachable: buttons.filter((button) => button.tabIndex === 0).length,
      note: document.querySelector('.cockpit__note')?.textContent ?? '',
      places: [...document.querySelectorAll('.roster__place')].map((place) => place.textContent),
      partial: [...document.querySelectorAll('.roster__partial')].map((note) => note.textContent),
      focused: document.activeElement?.closest('li')?.querySelector('.roster__name')?.textContent,
      stop: document
        .querySelector('nav[aria-label="Sessions"] button[tabindex="0"]')
        ?.querySelector('.roster__name')?.textContent,
      standing: document.querySelector('.indicator')?.textContent ?? '',
      feedLabel: document.querySelector('.feed__viewport')?.getAttribute('aria-label') ?? '',
    }
  })
}

export async function proveRoster(page) {
  await page.waitForSelector('nav[aria-label="Sessions"] button')
  const first = await readRoster(page)
  assert.equal(first.count, 6)
  // Nothing is chosen until a reader chooses it, and the Feed says so rather than showing one
  // Session's history under no name.
  assert.equal(first.selected, 0)
  assert.equal(first.standing, 'Choose a Session to read its history.')
  // One stop for the whole list, arrows inside it: the roving tabindex a list of rows needs.
  assert.equal(first.reachable, 1)
  assert.equal(first.note.includes('Read 7 transcript files.'), true)
  // The partial chain says so on its own row, in a sentence a reader can actually read to the end.
  assert.deepEqual(first.partial, ['continues a Session Argo did not read'])
  // A path is drawn as itself. The rule that truncates it from the start must not also move the
  // leading slash to the end, which is what `direction: rtl` does on its own.
  assert.deepEqual([...new Set(first.places)].sort(), [
    '/Users/x/proj',
    '/Users/x/prose',
    '/Users/x/stranded',
    '/Users/x/tree',
  ])

  await openSession(page, 'Pick the ink', 'askPending')
  const chosen = await readRoster(page)
  assert.equal(chosen.selected, 1)
  assert.equal(chosen.reachable, 1)
  assert.equal(chosen.feedLabel, 'Session history')

  // The one tab stop follows FOCUS, not selection. Arrowing down and tabbing away has to come back
  // to the row the reader was on; a stop keyed to the chosen Session sends them back to the top of
  // the list instead, and counting stops alone cannot tell the two apart.
  await page.keyboard.press('ArrowDown')
  const moved = await readRoster(page)
  assert.equal(moved.reachable, 1)
  assert.notEqual(moved.focused, undefined)
  assert.notEqual(moved.focused, 'Pick the ink')
  assert.equal(moved.stop, moved.focused)
  // Moving focus chose nothing: the Feed stays where the reader put it.
  assert.equal(moved.selected, 1)
  return chosen
}

// Nothing watches the transcripts, so the Roster is as old as the pass that made it. A Session
// written while Argo is running reaches the list when the reader asks for another pass, and this
// is that path end to end: a real file appearing in the tree, through the packaged main process.
export async function proveReread(page, transcripts, write) {
  await write(transcripts, ['titledHeadless'], 'project-two')
  await page.click('button:has-text("Read again")')
  // Its own custom title, which is what the Roster draws for it (CONTEXT.md L2 · CLI title).
  await page.waitForSelector('button:has-text("The name a person typed")')
  const after = await readRoster(page)
  assert.equal(after.count, 7)
  assert.equal(after.note.includes('Read 8 transcript files.'), true)
}

// The wait is keyed to the Session id, not to "some row exists": the Feed the reader is leaving
// still has rows on screen the moment the click lands, and waiting on those waits for nothing.
export async function openSession(page, name, sessionId) {
  await page.click(`button:has-text(${JSON.stringify(name)})`)
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
}
