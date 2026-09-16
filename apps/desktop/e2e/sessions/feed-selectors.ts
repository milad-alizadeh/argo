// A kept (inactive) Session's viewport stays mounted (#1834), so a bare `.feed__viewport` can
// match the wrong one once a proof has opened more than one Session; every read scopes to the
// active document, or to the Session id under test, instead (#2201).
export const ACTIVE_FEED = '.feed__document[data-active="true"]'
export const ACTIVE_VIEWPORT = `${ACTIVE_FEED} .feed__viewport`

const REVISION_TIMEOUT_MS = 5_000

export async function offsetOf(page, anchor: string) {
  return page.evaluate(
    ({ selector, id }) => {
      const viewport = document.querySelector(selector)
      const row = viewport.querySelector(`[data-feed-row="${id}"]`)
      return row.getBoundingClientRect().top - viewport.getBoundingClientRect().top
    },
    { selector: ACTIVE_VIEWPORT, id: anchor },
  )
}

export async function viewportAnchor(page) {
  return page.evaluate((selector) => {
    const viewport = document.querySelector(selector)
    const row = [...viewport.querySelectorAll('[data-feed-row]')].find(
      (candidate) =>
        candidate.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top,
    )
    return {
      anchor: row.dataset.feedRow,
      offset: row.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
    }
  }, ACTIVE_VIEWPORT)
}

export async function waitForRevision(page, previous: string | undefined) {
  await page.waitForFunction(
    (revision) =>
      document.querySelector('.feed__document[data-active="true"]')?.dataset.revision !== revision,
    previous,
    { timeout: REVISION_TIMEOUT_MS },
  )
}

// The virtual/feed state a packaged failure needs to say where it broke, without a reader
// re-running the harness headed to look for themselves (#2201).
export async function feedStateSnapshot(page) {
  return page.evaluate(() => {
    const documents = [...document.querySelectorAll('.feed__document')].map((feedDocument) => {
      const viewport = feedDocument.querySelector('.feed__viewport')
      return {
        active: feedDocument.getAttribute('data-active'),
        revision: feedDocument.getAttribute('data-revision'),
        rowCount: viewport?.querySelectorAll('[data-feed-row]').length ?? null,
        rows: [...(viewport?.querySelectorAll('[data-feed-row]') ?? [])].map(
          (row) => row.textContent,
        ),
        session: viewport?.getAttribute('data-session') ?? null,
        scrollHeight: viewport?.scrollHeight ?? null,
        clientHeight: viewport?.clientHeight ?? null,
        scrollTop: viewport?.scrollTop ?? null,
      }
    })
    return {
      alerts: [...document.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent),
      documents,
      url: window.location.href,
    }
  })
}
