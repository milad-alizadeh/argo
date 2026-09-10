// Driving the PACKAGED cockpit from outside: the Project proof and the appearance capture share
// it, so both agree on what a state, a control and a chosen folder are.
//
// Nothing here holds the real keyboard or mouse. Every key and click is dispatched into the
// renderer over the debugging protocol, which is why these runs can be left alone.
export const DECK = '[data-component="ProjectDeck"] [data-state]'
export const CHROME_SUBJECT = '[data-component="ChromeBar"] span'

// The folder chooser is the main process's authority, so the stub replaces it in the main process.
// The shipped code reads `dialog.showOpenDialog` at call time and ships no test hook of its own.
export function stubChooser(application, filePaths) {
  return application.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = () =>
      Promise.resolve({ canceled: paths.length === 0, filePaths: paths })
  }, filePaths)
}

export async function waitForCockpit(page) {
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.listProjects === 'function')
  await page.waitForSelector(DECK)
}

export function deckState(page) {
  return page.getAttribute(DECK, 'data-state')
}

export function waitForDeck(page, state) {
  return page.waitForFunction(
    ([selector, expected]) =>
      document.querySelector(selector)?.getAttribute('data-state') === expected,
    [DECK, state],
  )
}

// `dispatchEvent` rather than a real click: the proof window is never shown, and an unpainted
// window has nothing to hit-test. The component's own handler still runs.
export function press(page, name) {
  return page.getByRole('button', { name, exact: true }).dispatchEvent('click')
}

export function deckHeading(page) {
  return page.textContent(`${DECK} h1`)
}

export function refusal(page) {
  return page.textContent('[data-component="ProjectRefusal"] [data-slot="item-title"]')
}

export function subject(page) {
  return page.textContent(CHROME_SUBJECT)
}

// The deck answers a press twice: once to say it is busy, and once with the reply. A wait that
// only reads the state can be satisfied by the first of those, and then every assertion after it
// is reading the screen and the file from BEFORE the action. So the transitions are recorded from
// before the press, and the wait is for a busy window that has closed.
async function recordDeck(page) {
  await page.evaluate((selector) => {
    const deck = document.querySelector(selector)
    const log = []
    const record = () =>
      log.push({ state: deck.getAttribute('data-state'), busy: deck.getAttribute('aria-busy') })
    record()
    const observer = new MutationObserver(record)
    observer.observe(deck, { attributes: true, attributeFilter: ['data-state', 'aria-busy'] })
    window.argoDeckLog = { log, observer }
  }, DECK)
}

async function settledDeck(page, state) {
  await page.waitForFunction((expected) => {
    const recorded = window.argoDeckLog?.log ?? []
    const last = recorded.at(-1)
    return (
      recorded.some((entry) => entry.busy === 'true') &&
      last?.busy === 'false' &&
      last?.state === expected
    )
  }, state)
  await page.evaluate(() => {
    window.argoDeckLog?.observer.disconnect()
    window.argoDeckLog = undefined
  })
}

// One registration or relocation, end to end: answer the chooser, press the control that opens
// it, and wait for the deck the reply produces. `folder` is null for a dismissed chooser.
export async function chooseThen(run, folder, { button, state }) {
  await stubChooser(run.application, folder === null ? [] : [folder])
  await recordDeck(run.page)
  await press(run.page, button)
  await settledDeck(run.page, state)
}

// The real menu item, found on the built application menu and clicked there. A menu accelerator is
// matched in the main process against a native key event, and a key dispatched into the renderer
// over the debugging protocol never becomes one, so the item itself is what stands in for the
// chord. Going through the built menu is what puts `src/menu.ts` under the proof: its accelerator
// is read back and asserted, and its click closure is the thing that sends the command.
export async function clickMenuItem(run, label, { accelerator, state }) {
  await recordDeck(run.page)
  const found = await run.application.evaluate(({ Menu }, name) => {
    const search = (items) => {
      for (const item of items) {
        if (item.label === name) return item
        const inside = item.submenu ? search(item.submenu.items) : null
        if (inside) return inside
      }
      return null
    }
    const item = search(Menu.getApplicationMenu().items)
    if (!item) throw new Error(`the application menu carries no item labelled ${name}`)
    item.click()
    return { accelerator: item.accelerator, enabled: item.enabled }
  }, label)
  await settledDeck(run.page, state)
  return { ...found, expected: accelerator }
}

export function show(application) {
  return application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.show()
    return window.isVisible()
  })
}
