// A new Session's chosen folder that is gone refuses the Send and keeps the draft; a saved Session
// whose worktree is gone continues in the main checkout, as Claude Code does. Both hold for every Harness.
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { Harness } from '@/harnesses/harness'
import { chooseHarness, openNewSessionByClick, sessionListIds } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

const run = promisify(execFile)
const FOLDER_MISSING =
  'The work location folder no longer exists, so the Turn was not sent. Choose another work location. Your draft is still saved.'

const WORKTREE_GONE = /The worktree .+ is gone, so this Session now works in the main checkout\./

export function git(folder: string, args: string[]) {
  const identity = ['-c', 'user.name=Argo', '-c', 'user.email=argo@example.invalid']
  return run('git', ['-C', folder, ...identity, ...args])
}

// A reload is how a person gets the worktree list read again before its refetch interval.
export async function reload(page: Page) {
  await page.reload()
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
}

function workLocationOption(page: Page, name: string) {
  return page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option', { name })
}

export async function chooseWorkLocation(page: Page, name: string) {
  await page.getByRole('button', { name: /^Work location:/ }).click()
  await workLocationOption(page, name).click()
  await expect(page.getByRole('button', { name: `Work location: ${name}` })).toBeVisible()
}

// Replaces whatever draft the composer kept with the prompt, and sends it.
async function sendReplacingDraft(page: Page, prompt: string) {
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(prompt)
  await page.keyboard.press('Enter')
  return composer
}

// Sends a prompt that main refuses, and expects the reason, the draft kept and no new Session.
export async function sendRefused(page: Page, prompt: string, reason: string | RegExp) {
  const known = await sessionListIds(page)
  const composer = await sendReplacingDraft(page, prompt)

  await expect(page.getByText(reason)).toBeVisible()
  await expect(composer).toContainText(prompt)
  expect(await sessionListIds(page)).toEqual(known)
}

// Adds a linked worktree and opens a new-Session composer on it for the Harness.
async function composeInNewWorktree(
  page: Page,
  { project, name }: { project: string; name: string },
  harness: Harness,
) {
  const worktree = path.join(path.dirname(project), name)
  await git(project, ['worktree', 'add', '--quiet', '-b', name, worktree])
  await reload(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, harness)
  await chooseWorkLocation(page, name)
  return worktree
}

async function proveOne(page: Page, project: string, harness: Harness) {
  const name = `removed-${harness}`
  const worktree = await composeInNewWorktree(page, { project, name }, harness)
  await git(project, ['worktree', 'remove', '--force', worktree])

  await sendRefused(page, `Reply from the removed ${harness} worktree.`, FOLDER_MISSING)

  await reload(page)
  await openNewSessionByClick(page)
  // The saved choice names a folder that is gone, so the composer falls back to a new worktree.
  await page.getByRole('button', { name: 'Work location: New worktree' }).click()
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible()
  await expect(workLocationOption(page, name)).toHaveCount(0)
  await page.keyboard.press('Escape')
}

// A saved Session whose worktree was removed resumes in the main checkout and says so.
async function proveResume(
  page: Page,
  { project, backend }: { project: string; backend: SessionHarnessBackend },
  harness: Harness,
) {
  const worktree = await composeInNewWorktree(
    page,
    { project, name: `resumed-${harness}` },
    harness,
  )
  const known = await sessionListIds(page)
  const prompt = `Reply from the ${harness} worktree before it is removed.`
  await sendReplacingDraft(page, prompt)
  await backend.waitForReply(page, { harness, prompt })
  await expect
    .poll(async () => (await sessionListIds(page)).filter((id) => !known.includes(id)))
    .toHaveLength(1)
  await git(project, ['worktree', 'remove', '--force', worktree])

  const again = `Reply again from the removed ${harness} worktree.`
  await sendReplacingDraft(page, again)
  await expect(page.getByText(WORKTREE_GONE)).toBeVisible()
  await backend.waitForReply(page, { harness, prompt: again })
}

export async function proveRemovedWorkLocation(
  page: Page,
  project: string,
  backend: SessionHarnessBackend,
) {
  await git(project, ['commit', '--allow-empty', '--quiet', '-m', 'base'])
  for (const harness of ['claude', 'codex'] as const) {
    await proveOne(page, project, harness)
    await proveResume(page, { project, backend }, harness)
  }
}
