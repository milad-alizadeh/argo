// A worktree removed after it was picked fails the Send visibly, the same way for every Harness (#3007).
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { Harness } from '@/harnesses/harness'
import { chooseHarness, openNewSessionByClick, sessionListIds } from '../gestures'

const run = promisify(execFile)
const SEND_FAILED = 'The Turn could not be sent. Your draft is still saved.'

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

async function proveOne(page: Page, project: string, harness: Harness) {
  const name = `removed-${harness}`
  const worktree = path.join(path.dirname(project), name)
  await git(project, ['worktree', 'add', '--quiet', '-b', name, worktree])
  await reload(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, harness)
  await chooseWorkLocation(page, name)
  await git(project, ['worktree', 'remove', '--force', worktree])

  const known = await sessionListIds(page)
  const prompt = `Reply from the removed ${harness} worktree.`
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(prompt)
  await page.keyboard.press('Enter')

  await expect(page.getByText(SEND_FAILED)).toBeVisible()
  await expect(composer).toContainText(prompt)
  expect(await sessionListIds(page)).toEqual(known)

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
