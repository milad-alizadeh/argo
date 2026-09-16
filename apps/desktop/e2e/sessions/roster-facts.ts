// The merged roster list (#2194 follow-up) tells an active row from an archived one by
// `data-archived`, not by which `nav` it sits in: both share `nav[aria-label="Sessions"]`.
export function readRosterIds(page, section: 'Sessions' | 'Archived' = 'Sessions') {
  const selector =
    section === 'Archived'
      ? 'nav[aria-label="Sessions"] button[data-session-id][data-archived="true"]'
      : 'nav[aria-label="Sessions"] button[data-session-id][data-archived="false"]'
  return page
    .locator(selector)
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-session-id')))
}

const ACTIVE_ROW = 'nav[aria-label="Sessions"] button[data-archived="false"]'

// The order the roster settles on is the claim a caller waits for, so a timeout says what it read.
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
    const read = (await readRosterIds(page)).join('|')
    throw new Error(`Roster order: expected ${expected.join('|')}, read ${read}`, { cause })
  }
}
