// Driving the cockpit under test from outside: the screen capture and the startup measure share
// it, so both agree on what a drawn screen is.
//
// Nothing here holds the real keyboard or mouse: every read goes into the renderer over the
// debugging protocol, which is why these runs can be left alone.
import type { ElectronApplication, Page } from 'playwright-core'

// What each screen draws once it is ready: a selected Project draws its Session List, and no Project
// draws the empty-project window (#2307).
const SCREENS = {
  project: (page: Page) => page.getByRole('complementary', { name: 'Sessions' }),
  empty: (page: Page) => page.locator('[data-component="EmptyProjectWindow"]'),
}

export type Screen = keyof typeof SCREENS

export async function waitForScreen(page: Page, screen: Screen) {
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
  await SCREENS[screen](page).waitFor()
}

export function show(application: ElectronApplication) {
  return application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window === undefined) throw new Error('The app opened no window.')
    window.show()
    return window.isVisible()
  })
}
