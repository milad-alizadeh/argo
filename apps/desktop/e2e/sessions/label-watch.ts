import type { Page } from 'playwright-core'

// One element whose aria-label a test records into `window[key]`. With `missing`, a frame without
// the element records "(missing)", so a control that vanishes counts as a change.
export type LabelWatch = { selector: string; key: string; missing: boolean }

// Records each aria-label an open Session commits on one element, so a label shown for one frame
// still counts. It watches the document node, so it also runs as an init script before the root
// exists.
export function watchLabels({ selector, key, missing }: LabelWatch) {
  const labels: string[] = []
  const record = () => {
    if (/\/sessions\/new(\?|$)/.test(location.hash)) return
    const element = document.querySelector(selector)
    const label = element ? element.getAttribute('aria-label') : missing && '(missing)'
    if (label && labels.at(-1) !== label) labels.push(label)
  }
  record()
  new MutationObserver(record).observe(document, {
    attributes: true,
    childList: true,
    subtree: true,
  })
  Object.assign(window, { [key]: labels })
}

export function recordedLabels(page: Page, key: string) {
  return page.evaluate((name) => (window as unknown as Record<string, string[]>)[name], key)
}
