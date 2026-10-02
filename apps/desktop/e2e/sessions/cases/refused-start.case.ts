// A Harness that cannot start refuses the Send with its reason and keeps the draft, for every Harness.
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import { MOCK_START_REFUSED_FILE } from '@/mocks/cli/mock-cli'
import { chooseHarness, openNewSessionByClick } from '../gestures'
import { reload, sendRefused } from './removed-work-location.case'

const START_FAILED = /could not start, so the Turn was not sent/

export async function proveRefusedStart(page: Page, project: string) {
  // A new Session starts in the main checkout while the Worktree switch is off.
  const marker = path.join(project, MOCK_START_REFUSED_FILE)
  await writeFile(marker, '')
  try {
    for (const harness of ['claude', 'codex'] as const) {
      // A reload clears the other Harness's toast, so the reason below names this one.
      await reload(page)
      await openNewSessionByClick(page)
      await chooseHarness(page, harness)
      await sendRefused(page, `Start ${harness} where it cannot run.`, START_FAILED)
    }
  } finally {
    await rm(marker, { force: true })
  }
}
