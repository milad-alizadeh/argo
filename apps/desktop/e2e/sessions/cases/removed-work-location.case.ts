// A Send that never reaches the Harness shows its reason and keeps the draft, for every Harness.
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { Harness } from '@/harnesses/harness'
import { MOCK_START_REFUSED_FOLDER } from '@/mocks/cli/mock-cli'
import { chooseHarness, openNewSessionByClick, sessionListIds } from '../gestures'

const run = promisify(execFile)
const WORKSPACE_MISSING =
  'The work location folder no longer exists, so the Turn was not sent. Choose another work location. Your draft is still saved.'
const HARNESS_LABELS: Record<Harness, string> = { claude: 'Claude Code', codex: 'Codex' }

function git(folder: string, args: string[]) {
  const identity = ['-c', 'user.name=Argo', '-c', 'user.email=argo@example.invalid']
  return run('git', ['-C', folder, ...identity, ...args])
}

// A reload is how a person gets the Workspace list read again before its refetch interval.
async function reload(page: Page) {
  await page.reload()
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
}

function workLocationOption(page: Page, name: string) {
  return page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option', { name })
}

async function chooseWorkLocation(page: Page, name: string) {
  await page.getByRole('button', { name: /^Work location:/ }).click()
  await workLocationOption(page, name).click()
  await expect(page.getByRole('button', { name: `Work location: ${name}` })).toBeVisible()
}

// Sends a prompt that main refuses, and expects the reason, the draft kept and no new Session.
async function sendRefused(page: Page, prompt: string, reason: string) {
  const known = await sessionListIds(page)
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(prompt)
  await page.keyboard.press('Enter')

  await expect(page.getByText(reason)).toBeVisible()
  await expect(composer).toContainText(prompt)
  expect(await sessionListIds(page)).toEqual(known)
}

async function proveOne(page: Page, project: string, harness: Harness) {
  const name = `removed-${harness}`
  const worktree = path.join(path.dirname(project), name)
  await git(project, ['worktree', 'add', '--quiet', '-b', name, worktree])
  await reload(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, harness)
  await chooseWorkLocation(page, name)
  await git(project, ['worktree', 'remove', '--force', worktree])

  await sendRefused(page, `Reply from the removed ${harness} worktree.`, WORKSPACE_MISSING)

  await reload(page)
  await openNewSessionByClick(page)
  // The saved choice names a folder that is gone, so the composer falls back to a new worktree.
  await page.getByRole('button', { name: 'Work location: New worktree' }).click()
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible()
  await expect(workLocationOption(page, name)).toHaveCount(0)
  await page.keyboard.press('Escape')
}

export async function proveRemovedWorkLocation(page: Page, project: string) {
  await git(project, ['commit', '--allow-empty', '--quiet', '-m', 'base'])
  for (const harness of ['claude', 'codex'] as const) await proveOne(page, project, harness)
}

// The mock CLI fails before it names the Session in this folder, so the Turn was never sent.
export async function proveRefusedStart(page: Page, project: string) {
  await git(project, ['commit', '--allow-empty', '--quiet', '-m', 'base'])
  const worktree = path.join(path.dirname(project), MOCK_START_REFUSED_FOLDER)
  await git(project, ['worktree', 'add', '--quiet', '-b', 'refused', worktree])
  await reload(page)
  for (const harness of ['claude', 'codex'] as const) {
    await openNewSessionByClick(page)
    await chooseHarness(page, harness)
    await chooseWorkLocation(page, MOCK_START_REFUSED_FOLDER)
    const label = HARNESS_LABELS[harness]
    const reason = `${label} could not start, so the Turn was not sent. Check that ${label} runs in a terminal. Your draft is still saved.`
    await sendRefused(page, `Start ${harness} where it cannot run.`, reason)
    // The kept draft sends again unchanged and gets the same answer, not an uncertain one.
    await expect(page.getByText(reason)).toBeHidden({ timeout: 15_000 })
    await page.keyboard.press('Enter')
    await expect(page.getByText(reason)).toBeVisible()
  }
}
