// The packaged CSP determines which images load; the Feed must remain at the tail as they settle.
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

// A long plain turn after the formatted one keeps the formatted turn outside the reader's tail.
const FOLLOWING_TURN = 'The reader holds this row while the turn above it finishes. '.repeat(120)

// Read the formatted row's first frame before anything asynchronous inside it ran.
async function firstDrawn(page) {
  const handle = await page.waitForFunction(
    (feed) => {
      const viewport = document.querySelector(`${feed} .feed__viewport`)
      const rows = [...(viewport?.querySelectorAll('[data-feed-row]') ?? [])]
      const formatted = rows.find((row) => row.dataset.feedRow === 'p-formatted:0')
      if (
        formatted === undefined ||
        formatted.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top
      ) {
        return null
      }
      return {
        formatted: formatted.dataset.feedRow,
        highlightedAtDraw: formatted.querySelector('code[data-highlighted="true"]') !== null,
        loadingAtDraw: formatted.querySelectorAll('button[data-state="loading"]').length,
      }
    },
    ACTIVE_FEED,
    { timeout: SETTLE_TIMEOUT_MS, polling: 'raf' },
  )
  return handle.jsonValue()
}

async function settledReading(page, drawn) {
  await page.waitForFunction(
    ({ feed, id }) => {
      const viewport = document.querySelector(`${feed} .feed__viewport`)
      const row = document.querySelector(`${feed} .feed__viewport [data-feed-row="${id}"]`)
      return (
        row !== null &&
        viewport !== null &&
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 1 &&
        row.querySelector('code[data-highlighted="true"]') !== null &&
        row.querySelectorAll('button[data-state="loaded"]').length === 2 &&
        row.querySelectorAll('figure').length === 2
      )
    },
    { feed: ACTIVE_FEED, id: drawn.formatted },
    { timeout: SETTLE_TIMEOUT_MS },
  )
  return page.evaluate(
    ({ feed, formatted }) => {
      const viewport = document.querySelector(`${feed} .feed__viewport`)
      const row = viewport.querySelector(`[data-feed-row="${formatted}"]`)
      const links = [...row.querySelectorAll('a')]
      return {
        fromTail: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
        height: row.getBoundingClientRect().height,
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
  await fixture.append(fixture.transcripts, 'p-formatted', formattedTurn(localPicture))
  await fixture.append(fixture.transcripts, 'p-formatted-after', FOLLOWING_TURN)
  const drawn = await firstDrawn(page)
  const settled = await settledReading(page, drawn)

  assert.equal(settled.fromTail <= 1, true)
  assert.equal(settled.height > 0, true)
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
  // Highlighting and image loads may finish before the first sampled frame.
  return {
    fromTail: settled.fromTail,
    highlightedAtDraw: drawn.highlightedAtDraw,
    loadingAtDraw: drawn.loadingAtDraw,
  }
}
