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
  assert.deepEqual({ found: list.filesFound, read: list.filesRead }, { found: 10, read: 10 })
  // Eight Sessions from ten files, discovered without one registered Project.
  assert.deepEqual(list.sessions.map((session) => session.id).sort(), [
    'askPending',
    'externalBasic',
    'plannedWork',
    'prose',
    'resumeParent',
    'rollout-codexParent',
    'strandedResume',
    'unparseableBody',
  ])
  // The archive flag is the desktop app's own, read out of its store and joined on the CLI
  // Session id. Only the Session that store names is archived.
  assert.deepEqual(
    list.sessions.filter((session) => session.archived).map((session) => session.id),
    ['plannedWork'],
  )
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
      names: buttons.map((button) => button.textContent ?? ''),
      selected: buttons.filter((button) => button.getAttribute('aria-current') === 'true').length,
      reachable: buttons.filter((button) => button.tabIndex === 0).length,
      places: [...document.querySelectorAll('.roster__place')].map((place) => place.textContent),
      // The archive section's own trigger and the rows behind it, which are drawn only once a
      // reader opens it.
      archived: document.querySelector('.roster__archived [data-slot="collapsible-trigger"]')
        ?.textContent,
      archivedRows: document.querySelectorAll('nav[aria-label="Archived"] button').length,
      focused: document.activeElement?.closest('li')?.querySelector('.roster__name')?.textContent,
      stop: document
        .querySelector('nav[aria-label="Sessions"] button[tabindex="0"]')
        ?.querySelector('.roster__name')?.textContent,
      standing: document.querySelector('.feed__standing')?.textContent ?? '',
      feedLabel: document.querySelector('.feed__viewport')?.getAttribute('aria-label') ?? '',
    }
  })
}

// Chooses every row in order and reads the place the deck head draws for it. The wait is on the
// row being the chosen one AND the head naming it, so a head still drawing the last Session is
// never read as this one's.
async function readPlaces(page, count) {
  const places = []
  for (let index = 0; index < count; index += 1) {
    await page.click(`nav[aria-label="Sessions"] li:nth-child(${index + 1}) button`)
    const place = await page.waitForFunction((at) => {
      const button = document.querySelectorAll('nav[aria-label="Sessions"] button')[at]
      const name = button?.querySelector('.roster__name')?.textContent
      const head = document.querySelector('.deck__head h2')?.textContent
      if (button?.getAttribute('aria-current') !== 'true' || name !== head) return null
      // An object and not the bare text: a Session with no place reads '', and a falsy return is
      // what keeps the wait waiting.
      return { text: document.querySelector('.roster__place')?.textContent ?? null }
    }, index)
    const { text } = await place.jsonValue()
    if (text !== null) places.push(text)
  }
  return places
}

export async function proveRoster(page) {
  await page.waitForSelector('nav[aria-label="Sessions"] button')
  const first = await readRoster(page)
  assert.equal(first.count, 7)
  // Nothing is chosen until a reader chooses it, and the Feed says so rather than showing one
  // Session's history under no name.
  assert.equal(first.selected, 0)
  assert.equal(first.standing.includes('No Session selected'), true)
  // One stop for the whole list, arrows inside it: the roving tabindex a list of rows needs.
  assert.equal(first.reachable, 1)
  // The archived Session is out of the list and behind the section at the foot, which says how
  // many it holds and draws none of them until it is opened.
  assert.equal(first.archived, 'Archived1')
  assert.equal(first.archivedRows, 0)
  // A path is drawn as itself. The rule that truncates it from the start must not also move the
  // leading slash to the end, which is what `direction: rtl` does on its own. The deck head says
  // the place of the one Session that is chosen, so each row is chosen in turn to read them all.
  assert.deepEqual(first.places, [])
  const places = await readPlaces(page, first.count)
  assert.deepEqual([...new Set(places)].sort(), [
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
  await write(transcripts, ['titledHeadless'], { directory: 'project-two' })
  await page.click('button[aria-label="Read again"]')
  // Its own custom title, which is what the Roster draws for it (CONTEXT.md L2 · CLI title).
  await page.waitForSelector('button:has-text("The name a person typed")')
  const after = await readRoster(page)
  assert.equal(after.count, 8)
}

// The archive is a section a reader opens, and the Session inside it is the one the desktop app's
// store named. It is drawn only once the section is open, so a reader with hundreds of archived
// runs pays for none of them until they ask.
export async function proveArchive(page) {
  await page.click('.roster__archived [data-slot="collapsible-trigger"]')
  await page.waitForSelector('nav[aria-label="Archived"] button')
  const open = await readRoster(page)
  assert.equal(open.archivedRows, 1)
  // Opening the section moved nothing out of the list above it.
  assert.equal(open.count, 8)
  // The chevron turns with the section. The open state lives on the trigger, so an icon styled off
  // its own element would sit still through every open and no row count would notice. Waited for
  // rather than read once: the turn is a transition, so the first frame after the click is still
  // part of the way there. `rotate-90` in Tailwind v4 sets the `rotate` property, not `transform`.
  await page.waitForFunction(() => {
    const icon = document.querySelector('.roster__archived [data-slot="collapsible-trigger"] svg')
    return icon !== null && getComputedStyle(icon).rotate === '90deg'
  })
}

// Codex records do not watch themselves either. This is deliberately a mutation of the existing
// Codex file rather than a fresh fixture: a later record must replace the cached summary after
// the reader requests a pass, and the shared Roster must order it by that new evidence.
export async function proveCodexReread(page, transcripts, grow) {
  const before = await readRoster(page)
  assert.notEqual(before.names[0], 'Run Codex check')

  await grow(transcripts)
  await page.click('button[aria-label="Read again"]')
  await page.waitForFunction(
    () =>
      document
        .querySelector('nav[aria-label="Sessions"] button')
        ?.textContent?.includes('Run Codex check') ?? false,
  )

  const after = await readRoster(page)
  assert.equal(after.names[0].includes('Run Codex check'), true)
  assert.equal(after.count, 8)
}

// The wait is keyed to the Session id, not to "some row exists": the Feed the reader is leaving
// still has rows on screen the moment the click lands, and waiting on those waits for nothing.
export async function openSession(page, name, sessionId) {
  await page.click(`button:has-text(${JSON.stringify(name)})`)
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
}
