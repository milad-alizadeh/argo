// The wait is keyed to the Session id, not to "some row exists": the Feed the reader is leaving
// still has rows on screen the moment the click lands, and waiting on those waits for nothing.
export async function openSession(page, name, sessionId) {
  await page.click(`button:has-text(${JSON.stringify(name)})`)
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
}
