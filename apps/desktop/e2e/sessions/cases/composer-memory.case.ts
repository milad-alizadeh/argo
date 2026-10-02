import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import { fixtureSession } from '../fixture-sessions'
import { CODEX_PARENT } from '../fixtures/feed.fixture'
import {
  chooseHarness,
  openNewSessionByClick,
  openSessionByClick,
  TURN_CONFIGURATION,
} from '../gestures'

// One Claude and one Codex Session, each with a draft of its own.
const DRAFTS = [
  { fixture: 'setupAnswered', prompt: 'Half a thought.' },
  { fixture: CODEX_PARENT, prompt: 'Another half thought.' },
]

// Drafts and the Harness a new Session was set to outlive a reload of the window (#3153).
export async function proveComposerMemory(page: Page) {
  const message = page.getByRole('combobox', { name: 'Message' })
  for (const draft of DRAFTS) {
    await openSessionByClick(page, await fixtureSession(draft.fixture))
    await message.click()
    await page.keyboard.type(draft.prompt)
  }
  await openNewSessionByClick(page)
  await chooseHarness(page, 'codex')

  await page.reload()
  await expect(page.locator(TURN_CONFIGURATION)).toHaveAttribute(
    'aria-label',
    /^Choose Turn configuration: Codex, /,
  )
  for (const draft of DRAFTS) {
    await openSessionByClick(page, await fixtureSession(draft.fixture))
    await expect(message).toHaveText(draft.prompt)
  }
}
