// The Feed virtualizes its rows (`AnchoredFeed.tsx`, `@tanstack/react-virtual`): only rows near
// the viewport's current scroll position exist in the DOM. A case that reaches for a row by its
// stable `data-feed-row` id must scroll it into the mounted window first, rather than assume the
// id is already present — a raw `querySelector` on a far row returns null even though the row is
// real (#2201).
export async function mountFeedRow(page, { rowId, session }: { rowId: string; session: string }) {
  const viewport = `.feed__viewport[data-session="${session}"]`
  await page.waitForSelector(viewport)
  const isMounted = () =>
    page.evaluate(
      ({ rowId, viewport }) =>
        document.querySelector(`${viewport} [data-feed-row="${rowId}"]`) !== null,
      { rowId, viewport },
    )
  if (await isMounted()) return
  const clientHeight = await page.evaluate(
    (selector) => document.querySelector(selector).clientHeight,
    viewport,
  )
  const step = Math.max(clientHeight, 1)
  let previousScrollTop = -1
  // Linear scan: react-virtual mounts only its overscan window around the current scrollTop, so a
  // row is scrolled toward one viewport height at a time until it appears or the scroller bottoms
  // out (the row does not exist, which is the caller's bug to find, not this helper's to hide).
  for (let position = 0, guard = 0; guard < 500; guard += 1, position += step) {
    await page.evaluate(
      ({ selector, top }) => {
        document.querySelector(selector).scrollTop = top
      },
      { selector: viewport, top: position },
    )
    if (await isMounted()) return
    const scrollTop = await page.evaluate(
      (selector) => document.querySelector(selector).scrollTop,
      viewport,
    )
    if (scrollTop === previousScrollTop) break
    previousScrollTop = scrollTop
  }
  throw new Error(`feed row "${rowId}" in session "${session}" never mounted while scrolling`)
}
