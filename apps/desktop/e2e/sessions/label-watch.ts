import type { Page } from 'playwright-core'

// Records each aria-label an open Session commits on one element, so a label shown for one frame
// still counts. It watches the document node, so it also runs as an init script before the root
// exists. The labels land on `window[key]`.
export function watchLabels({ selector, key }: { selector: string; key: string }) {
  const labels: string[] = []
  const record = () => {
    if (/\/sessions\/new(\?|$)/.test(location.hash)) return
    const label = document.querySelector(selector)?.getAttribute('aria-label')
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
