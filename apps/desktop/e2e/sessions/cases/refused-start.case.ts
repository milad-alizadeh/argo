// A Harness that cannot start refuses the Send with its reason and keeps the draft, for every Harness.
import path from 'node:path'
import type { Page } from 'playwright-core'
import { MOCK_START_REFUSED_FOLDER } from '@/mocks/cli/mock-cli'
import { chooseHarness, openNewSessionByClick } from '../gestures'
import { chooseWorkLocation, git, reload, sendRefused } from './removed-work-location.case'

const START_FAILED = /could not start, so the Turn was not sent/

export async function proveRefusedStart(page: Page, project: string) {
  await git(project, ['commit', '--allow-empty', '--quiet', '-m', 'base'])
  const worktree = path.join(path.dirname(project), MOCK_START_REFUSED_FOLDER)
  await git(project, ['worktree', 'add', '--quiet', '-b', 'refused', worktree])
  for (const harness of ['claude', 'codex'] as const) {
    // A reload clears the other Harness's toast, so the reason below names this one.
    await reload(page)
    await openNewSessionByClick(page)
    await chooseHarness(page, harness)
    await chooseWorkLocation(page, MOCK_START_REFUSED_FOLDER)
    await sendRefused(page, `Start ${harness} where it cannot run.`, START_FAILED)
  }
}
