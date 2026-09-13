// The formatted half of the packaged Session proof (#1835): an assistant turn written in Markdown
// arrives while the reader is at the tail, and its code highlighting, image loads and image
// failures finish after the row is drawn without moving the reader or outgrowing the row's
// measured height (ADR-0035). It runs in the shipped app because the renderer's CSP decides which
// images load, and only the packaged page carries the policy it ships with.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

type FormattedFixture = {
  root: string
  transcripts: string
  append: (transcripts: string, uuid: string, text: string) => Promise<void>
}

const SETTLE_TIMEOUT_MS = 10_000
const ACTIVE_FEED = '.feed__document[data-active="true"]'
const PICTURE = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="213"><rect width="320" height="213" fill="#0ea5e9"/></svg>`
const DATA_PICTURE = `data:image/svg+xml,${encodeURIComponent(PICTURE)}`

function formattedTurn(localPicture: string) {
  return `The formatted turn links [the ticket](https://github.com/milad-alizadeh/argo/issues/1835) and refuses [a script](javascript:alert(1)).

\`\`\`ts
type Session = { id: string }
export const title = (session: Session) => session.id
\`\`\`

\`\`\`argo-plan
step one: attach an image
\`\`\`

![An inline picture](${DATA_PICTURE}) ![A local picture](${localPicture}) ![A missing picture](/argo-proof/missing-picture.png) ![A moved picture](shots/moved.png)

Raw HTML stays text: <script>window.feedHacked = true</script>`
}

// A long plain turn after the formatted one, so the reader's first visible row sits below it and
// any growth in the formatted row would push that row down.
const FOLLOWING_TURN = 'The reader holds this row while the turn above it finishes. '.repeat(120)

function drawnRowCount(page) {
  return page.evaluate(
    (feed) => document.querySelectorAll(`${feed} .feed__viewport [data-feed-row]`).length,
    ACTIVE_FEED,
  )
}

// Read on the first frame both new rows are drawn, before anything asynchronous inside them ran.
async function firstDrawn(page, count) {
  const handle = await page.waitForFunction(
    ({ feed, expected }) => {
      const viewport = document.querySelector(`${feed} .feed__viewport`)
      const rows = [...(viewport?.querySelectorAll('[data-feed-row]') ?? [])]
      if (rows.length !== expected) return null
      const anchor = rows.find(
        (row) => row.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top,
      )
      const formatted = rows.at(-2)
      return {
        anchor: anchor.dataset.feedRow,
        formatted: formatted.dataset.feedRow,
        offset: anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
        highlightedAtDraw: formatted.querySelector('code[data-highlighted="true"]') !== null,
        loadingAtDraw: formatted.querySelectorAll('button[data-state="loading"]').length,
      }
    },
    { feed: ACTIVE_FEED, expected: count },
    { timeout: SETTLE_TIMEOUT_MS, polling: 'raf' },
  )
  return handle.jsonValue()
}

async function settledReading(page, drawn) {
  await page.waitForFunction(
    ({ feed, id }) => {
      const row = document.querySelector(`${feed} .feed__viewport [data-feed-row="${id}"]`)
      return (
        row?.querySelector('code[data-highlighted="true"]') !== null &&
        row.querySelectorAll('button[data-state="loaded"]').length === 2 &&
        row.querySelectorAll('figure').length === 2
      )
    },
    { feed: ACTIVE_FEED, id: drawn.formatted },
    { timeout: SETTLE_TIMEOUT_MS },
  )
  return page.evaluate(
    ({ feed, formatted, anchor }) => {
      const viewport = document.querySelector(`${feed} .feed__viewport`)
      const row = viewport.querySelector(`[data-feed-row="${formatted}"]`)
      const measured = document.querySelector(
        `${feed} .feed__measured [data-feed-row="${formatted}"]`,
      )
      const links = [...row.querySelectorAll('a')]
      return {
        offset:
          viewport.querySelector(`[data-feed-row="${anchor}"]`).getBoundingClientRect().top -
          viewport.getBoundingClientRect().top,
        stated: Number.parseFloat(row.style.height),
        natural: measured.getBoundingClientRect().height,
        overflow: row.scrollHeight - row.clientHeight,
        languages: [...row.querySelectorAll('[data-language]')].map((code) =>
          code.getAttribute('data-language'),
        ),
        unavailable: [...row.querySelectorAll('figure')].map((figure) => figure.textContent),
        links: links.map((link) => ({ href: link.getAttribute('href'), target: link.target })),
        refusedLink: row.textContent.includes('a script'),
        scripts: row.querySelectorAll('script').length,
        rawHtmlText: row.textContent.includes('<script>window.feedHacked = true</script>'),
        hacked: 'feedHacked' in window,
      }
    },
    { ...drawn, feed: ACTIVE_FEED },
  )
}

export async function proveFormattedFeed(page, fixture: FormattedFixture) {
  const localPicture = path.join(fixture.root, 'formatted-picture.svg')
  await writeFile(localPicture, PICTURE)
  const before = await drawnRowCount(page)
  await fixture.append(fixture.transcripts, 'p-formatted', formattedTurn(localPicture))
  await fixture.append(fixture.transcripts, 'p-formatted-after', FOLLOWING_TURN)
  const drawn = await firstDrawn(page, before + 2)
  const settled = await settledReading(page, drawn)

  assert.notEqual(drawn.anchor, drawn.formatted)
  assert.equal(Math.abs(settled.offset - drawn.offset) <= 1, true)
  assert.equal(Math.abs(settled.stated - settled.natural) <= 0.5, true)
  assert.equal(settled.overflow, 0)
  assert.deepEqual(settled.languages, ['typescript', 'plain'])
  assert.deepEqual(settled.unavailable, [
    'Image unavailableA missing picture',
    'Image unavailableA moved picture',
  ])
  assert.deepEqual(settled.links, [
    { href: 'https://github.com/milad-alizadeh/argo/issues/1835', target: '_blank' },
  ])
  assert.equal(settled.refusedLink, true)
  assert.equal(settled.scripts, 0)
  assert.equal(settled.rawHtmlText, true)
  assert.equal(settled.hacked, false)
  // Printed, not asserted: whether highlighting or a load was still pending at the first frame
  // depends on the machine, and the anchor holds either way.
  return {
    anchoredMotion: settled.offset - drawn.offset,
    highlightedAtDraw: drawn.highlightedAtDraw,
    loadingAtDraw: drawn.loadingAtDraw,
  }
}
