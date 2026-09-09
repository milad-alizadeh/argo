// PROTOTYPE harness. Drives the same script through all four variants against the installed
// Chrome, so the comparison is measured rather than asserted. `bun run drive`.

import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5273'
const SHOTS = 'shots'
mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--force-color-profile=srgb', '--font-render-hinting=none'],
})

const readout = (page) =>
  page.evaluate(() => {
    const out = {}
    const list = document.querySelector('.readout dl')
    if (!list) return out
    const kids = Array.from(list.children)
    for (let i = 0; i < kids.length; i += 2) out[kids[i].textContent] = kids[i + 1].textContent
    return out
  })

const field = (page) =>
  page.evaluate(() => {
    const box = document.querySelector('.field')
    if (!box) return null
    return { client: Math.round(box.clientHeight), scroll: Math.round(box.scrollHeight) }
  })

/**
 * What is inked in the accent, however the variant spells it: a class in three of them, an inline
 * style in Lexical. Asked of the computed colour, so no variant is credited for a class it did
 * not paint with.
 */
const inked = (page) =>
  page.evaluate(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    const hit = (el) => {
      const colour = getComputedStyle(el).color
      // --accent is #3e9bff; computed comes back as rgb(62, 155, 255).
      return colour === 'rgb(62, 155, 255)' || colour === accent
    }
    return Array.from(document.querySelectorAll('.vessel span, .vessel .cm-line span'))
      .filter((el) => el.textContent && hit(el))
      .map((el) => el.textContent)
      .join('|')
  })

const menuRows = (page) => page.evaluate(() => document.querySelectorAll('.menu .row').length)

/**
 * Backspace, not ⌘A then delete.
 *
 * ⌘A in a plain textarea or contenteditable is the BROWSER's select-all, and a synthetic key
 * event over CDP does not reach that command layer — so ⌘A appeared to work in C and D only
 * because Lexical and CodeMirror implement select-all themselves in JavaScript. Measuring the
 * variants with it measures the harness.
 */
const clear = async (page) => {
  await page.keyboard.press('Backspace', { delay: 0 })
  for (let i = 0; i < 120; i += 1) await page.keyboard.press('Backspace', { delay: 0 })
}

const report = []

for (const variant of ['A', 'B', 'C', 'D']) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1180, height: 760, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto(`${BASE}/?variant=${variant}`, { waitUntil: 'networkidle0' })
  // The stubbed catalog answers after 1.4s; before that the menu is the reading state.
  await new Promise((r) => setTimeout(r, 1800))

  const row = { variant, errors }
  row.mounted = await page.evaluate(() => !!document.querySelector('.readout dl'))

  // 1. The command mark and the `/` menu.
  await page.keyboard.type('/imp')
  await new Promise((r) => setTimeout(r, 250))
  row.slashRows = await menuRows(page)
  row.slashInk = await inked(page)
  row.slashState = (await readout(page)).menu
  await page.screenshot({ path: `${SHOTS}/${variant}-1-slash.png` })

  // 2. Tab completes the row under the cursor.
  await page.keyboard.press('Tab')
  await new Promise((r) => setTimeout(r, 200))
  row.afterTab = (await readout(page)).draft
  row.afterTabInk = await inked(page)
  await page.screenshot({ path: `${SHOTS}/${variant}-2-picked.png` })

  // 3. The `@` menu at a token boundary, and Escape.
  await page.keyboard.type('look at @Composer')
  await new Promise((r) => setTimeout(r, 250))
  row.atRows = await menuRows(page)
  await page.screenshot({ path: `${SHOTS}/${variant}-3-mention.png` })
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 150))
  row.afterEscapeRows = await menuRows(page)
  row.afterEscapeDraft = (await readout(page)).draft

  // 4. An address must not open the menu — the token-boundary rule.
  await clear(page)
  await new Promise((r) => setTimeout(r, 150))
  row.afterClear = (await readout(page)).draft
  await page.keyboard.type('mail milad@example.com')
  await new Promise((r) => setTimeout(r, 250))
  row.addressRows = await menuRows(page)

  // 5. Growth: six lines, then the field scrolls inside itself.
  await clear(page)
  for (let i = 0; i < 7; i += 1) {
    await page.keyboard.down('Shift')
    await page.keyboard.press('Enter')
    await page.keyboard.up('Shift')
    await page.keyboard.type(`line ${i + 1}`)
  }
  await new Promise((r) => setTimeout(r, 250))
  row.field = await field(page)
  row.lines = ((await readout(page)).draft?.match(/\\n/g) ?? []).length
  await page.screenshot({ path: `${SHOTS}/${variant}-4-grown.png` })

  // 6. Return sends, and the field is left empty.
  await clear(page)
  await page.keyboard.type('/ship the branch')
  await new Promise((r) => setTimeout(r, 200))
  row.sendInk = await inked(page)
  await page.keyboard.press('Enter')
  await new Promise((r) => setTimeout(r, 250))
  row.afterSend = (await readout(page)).draft
  row.sentRows = await page.evaluate(() => document.querySelectorAll('.feed-row.sent').length)
  await page.screenshot({ path: `${SHOTS}/${variant}-5-sent.png` })

  // 7. Undo, which is where a hand-rebuilt DOM is expected to fail.
  await page.keyboard.type('one two three')
  await new Promise((r) => setTimeout(r, 150))
  await page.keyboard.down('Meta')
  await page.keyboard.press('z')
  await page.keyboard.up('Meta')
  await new Promise((r) => setTimeout(r, 200))
  row.afterUndo = (await readout(page)).draft

  report.push(row)
  await page.close()
}

await browser.close()
console.log(JSON.stringify(report, null, 2))
