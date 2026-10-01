// A launched app's first window, sized and hidden: every flow that drives the packaged app
// through its window does this same setup before it asks the window anything about itself.
import type { ElectronApplication, Page } from 'playwright-core'

export type WindowViewport = { width: number; height: number }

export async function openHiddenWindow(
  application: ElectronApplication,
  viewport: WindowViewport,
): Promise<Page> {
  application.process().stdout?.on('data', (chunk) => process.stdout.write(chunk))
  application.process().stderr?.on('data', (chunk) => process.stderr.write(chunk))
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  await application.evaluate(({ BrowserWindow }, size) => {
    const window = BrowserWindow.getAllWindows()[0]
    window?.setContentSize(size.width, size.height)
    window?.hide()
  }, viewport)
  await page.waitForFunction(
    (size) => window.innerWidth === size.width && window.innerHeight === size.height,
    viewport,
  )
  return page
}

// The launch redirects `/` to a Project's Sessions, with or without a ready Harness, and a hash
// set before that lands is replaced.
export async function openRoute(page: Page, route: string) {
  await page.waitForFunction(() => /^#\/projects\/[^/]+\//.test(window.location.hash))
  await page.evaluate((hash) => {
    window.location.hash = hash
  }, route)
}
