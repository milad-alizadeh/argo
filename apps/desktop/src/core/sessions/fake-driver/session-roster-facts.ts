export function readRosterIds(page, label = 'Sessions') {
  return page
    .locator(`nav[aria-label="${label}"] button`)
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-session-id')))
}
