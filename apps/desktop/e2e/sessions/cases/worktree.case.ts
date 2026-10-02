// A new worktree starts from the chosen branch, the Worktree switch is remembered per Project, and
// a Session whose worktree is gone continues in the main checkout, for every Harness.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { Harness } from '@/harnesses/harness'
import { chooseHarness, openNewSessionByClick, sessionListIds } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

const run = promisify(execFile)
const WORKTREE_GONE = /The worktree .+ is gone, so this Session now works in the main checkout\./

export function git(folder: string, args: string[]) {
  const identity = ['-c', 'user.name=Argo', '-c', 'user.email=argo@example.invalid']
  return run('git', ['-C', folder, ...identity, ...args])
}

// A reload is how a person gets the Worktree options read again before their refetch interval.
export async function reload(page: Page) {
  await page.reload()
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
}

// Keeps the text of every toast the page shows. The notice closes after 5s, and a loaded runner can
// stall the test past that between a reload and its next read (CI run 36993106639).
function recordToasts() {
  const shown: string[] = []
  Object.assign(window, { shownToasts: shown })
  new MutationObserver(() => {
    for (const toast of document.querySelectorAll('[data-slot="toast"]')) {
      const text = toast.textContent ?? ''
      if (toast.checkVisibility() && !shown.includes(text)) shown.push(text)
    }
  }).observe(document, { childList: true, subtree: true, characterData: true })
}

function shownToasts(page: Page) {
  return page.evaluate(() => (window as { shownToasts?: string[] }).shownToasts ?? [])
}

function worktreeSwitch(page: Page) {
  return page.getByRole('switch', { name: 'Worktree' })
}

// Turns the Worktree switch on and starts the new worktree from `branch`.
async function startFrom(page: Page, branch: string) {
  if ((await worktreeSwitch(page).getAttribute('aria-checked')) !== 'true')
    await worktreeSwitch(page).click()
  await expect(worktreeSwitch(page)).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: /^New worktree from / }).click()
  await page
    .getByRole('listbox', { name: 'Suggestions' })
    .getByRole('option', { name: branch })
    .click()
  await expect(page.getByRole('button', { name: `New worktree from ${branch}` })).toBeVisible()
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

async function linkedWorktrees(project: string): Promise<string[]> {
  const { stdout } = await git(project, ['worktree', 'list', '--porcelain'])
  const paths = stdout
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
  return paths.slice(1)
}

async function head(folder: string): Promise<string> {
  return (await git(folder, ['rev-parse', 'HEAD'])).stdout.trim()
}

// A Session started in a new worktree from a branch, whose worktree is then removed, moves to the
// main checkout as soon as it is opened again, says so, and resumes there.
async function proveResume(
  page: Page,
  { project, backend }: { project: string; backend: SessionHarnessBackend },
  harness: Harness,
) {
  const base = `base-${harness}`
  await git(project, ['branch', base])
  await git(project, ['commit', '--allow-empty', '--quiet', '-m', `after ${base}`])
  const baseCommit = (await git(project, ['rev-parse', base])).stdout.trim()
  await reload(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, harness)
  await startFrom(page, base)

  const knownSessions = await sessionListIds(page)
  const knownWorktrees = await linkedWorktrees(project)
  const prompt = `Reply from the ${harness} worktree before it is removed.`
  await sendReplacingDraft(page, prompt)
  await backend.waitForReply(page, { harness, prompt })
  await expect
    .poll(async () => (await sessionListIds(page)).filter((id) => !knownSessions.includes(id)))
    .toHaveLength(1)
  const [worktree] = (await linkedWorktrees(project)).filter(
    (path) => !knownWorktrees.includes(path),
  )
  if (worktree === undefined) throw new Error(`No worktree was made for the ${harness} Session.`)
  expect(await head(worktree)).toBe(baseCommit)
  const sessionUrl = page.url()
  await openNewSessionByClick(page)
  await reload(page)
  await git(project, ['worktree', 'remove', '--force', worktree])

  // Remove the folder while the Session is closed, then open it before any Send.
  await page.goto(sessionUrl)
  await expect.poll(() => shownToasts(page)).toContainEqual(expect.stringMatching(WORKTREE_GONE))
  const again = `Reply again from the removed ${harness} worktree.`
  await sendReplacingDraft(page, again)
  await backend.waitForReply(page, { harness, prompt: again })
}

export async function proveSessionWorktree(
  page: Page,
  { project, backend }: { project: string; backend: SessionHarnessBackend },
  harness: Harness,
) {
  await git(project, ['commit', '--allow-empty', '--quiet', '-m', 'base'])
  await page.addInitScript(recordToasts)
  await openNewSessionByClick(page)
  // A new Project starts in its main checkout.
  await expect(worktreeSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await proveResume(page, { project, backend }, harness)

  // The switch is remembered for the Project; the start goes back to the current branch.
  await reload(page)
  await openNewSessionByClick(page)
  await expect(worktreeSwitch(page)).toHaveAttribute('aria-checked', 'true')
  const current = (await git(project, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
  await expect(page.getByRole('button', { name: `New worktree from ${current}` })).toBeVisible()
}
