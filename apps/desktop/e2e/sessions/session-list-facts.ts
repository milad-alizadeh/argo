// The merged sessionList list (#2194 follow-up) tells an active row from an archived one by
// `data-archived`, not by which `nav` it sits in: both share `nav[aria-label="Sessions"]`.
export function readSessionListIds(page, section: 'Sessions' | 'Archived' = 'Sessions') {
  const selector =
    section === 'Archived'
      ? 'nav[aria-label="Sessions"] button[data-session-id][data-archived="true"]'
      : 'nav[aria-label="Sessions"] button[data-session-id][data-archived="false"]'
  return page
    .locator(selector)
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-session-id')))
}

const ACTIVE_ROW = 'nav[aria-label="Sessions"] button[data-archived="false"]'

// The order the sessionList settles on is the claim a caller waits for, so a timeout says what it read.
export async function waitForActiveSessions(page, expected: readonly string[]) {
  try {
    await page.waitForFunction(
      ({ selector, ids }) => {
        const rows = [...document.querySelectorAll(selector)]
        return rows.map((row) => row.getAttribute('data-session-id')).join('|') === ids.join('|')
      },
      { selector: ACTIVE_ROW, ids: expected },
    )
  } catch (cause) {
    const read = (await readSessionListIds(page)).join('|')
    throw new Error(`SessionList order: expected ${expected.join('|')}, read ${read}`, { cause })
  }
}

// A caller with no fixed target order (an already-discovered id whose row a click must land on,
// not a freshly-created one `waitForCreatedRow` already guards) still races the same virtualized
// reflow: a row a background history rescan is still discovering shifts every row below it by one
// translateY step, and a click Playwright already resolved lands on whichever row is there once
// the shift commits. Two reads the same, a beat apart, is the sessionList no longer mid-shift.
export async function waitForSessionListSettled(page, timeout = 30_000) {
  const deadline = Date.now() + timeout
  let last = (await readSessionListIds(page)).join('|')
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    const read = (await readSessionListIds(page)).join('|')
    if (read === last) return
    if (Date.now() > deadline)
      throw new Error(`SessionList order never settled, last read: ${read}`)
    last = read
  }
}
