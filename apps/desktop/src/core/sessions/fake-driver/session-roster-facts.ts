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
