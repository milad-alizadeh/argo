export async function viewportAnchor(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('.feed__viewport')
    const row = [...viewport.querySelectorAll('[data-feed-row]')].find(
      (candidate) =>
        candidate.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top,
    )
    return {
      anchor: row.dataset.feedRow,
      offset: row.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
    }
  })
}

export async function offsetOf(page, anchor) {
  return page.evaluate((id) => {
    const viewport = document.querySelector('.feed__viewport')
    const row = viewport.querySelector(`[data-feed-row="${id}"]`)
    return row.getBoundingClientRect().top - viewport.getBoundingClientRect().top
  }, anchor)
}

export async function waitForRevision(page, previous, options?: { timeout: number }) {
  await page.waitForFunction(
    (revision) => {
      return (
        document.querySelector('.feed__document[data-active="true"]')?.dataset.revision !== revision
      )
    },
    previous,
    options,
  )
}
