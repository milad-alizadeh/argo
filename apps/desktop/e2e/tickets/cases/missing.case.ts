// The Ticket proof's missing Tickets (#2874): a Ticket omitted by a failed scan is untouched; once
// a complete scan omits it, a direct read by ID finds it moved state or the provider confirms it
// deleted, and a deleted Ticket is hidden and keeps its row.
import assert from 'node:assert/strict'
import { expect, test } from '@playwright/test'
import { helloWorldRepository as helloWorld } from '@/mocks/tickets/provider-inputs'
import { TEAM } from '../../../mocks/providers/linear/mock-linear-cast'
import { backlog, committedTicket, openRoom, type Run, showWindow } from '../screen'

const GITHUB_SCOPE = { provider: 'github', scope: 'octocat/hello-world' }
const LINEAR_SCOPE = { provider: 'linear', scope: 'team-engine' }

const row = (run: Run, key: RegExp) => backlog(run.page).getByRole('button', { name: key })

// #609 is deleted and #273 is closed, so the next complete scan lists neither.
export async function proveGitHubMissing(run: Run, pollMs: number) {
  await showWindow(run.application, true)
  await row(run, /^#609/).waitFor()
  await row(run, /^#273/).waitFor()
  const deleted = committedTicket(run, GITHUB_SCOPE, '#609')
  assert.ok(deleted)
  const repository = helloWorld()
  repository.issues = repository.issues.filter((issue) => issue.number !== 609)
  const planner = repository.issues.find((issue) => issue.number === 273)
  if (planner) planner.state = 'closed'

  await test.step('github-failed-scan-omits-nothing', async () => {
    run.fixture.github.outage('down')
    run.fixture.github.addRepository(repository)
    await backlog(run.page).getByRole('alert').getByText('Argo cannot reach GitHub.').waitFor()
    await run.page.waitForTimeout(pollMs * 4)
    await expect(row(run, /^#609/)).toBeVisible()
    await expect(row(run, /^#273/)).toBeVisible()
    assert.equal(committedTicket(run, GITHUB_SCOPE, '#609')?.deletedAt, null)
    assert.equal(committedTicket(run, GITHUB_SCOPE, '#273')?.state, 'open')
  })
  await test.step('github-moved-state', async () => {
    run.fixture.github.outage('none')
    await expect(row(run, /^#273/)).toHaveCount(0)
    await expect.poll(() => committedTicket(run, GITHUB_SCOPE, '#273')?.state).toBe('closed')
    assert.equal(committedTicket(run, GITHUB_SCOPE, '#273')?.deletedAt, null)
  })
  await test.step('github-confirmed-deletion', async () => {
    await expect(row(run, /^#609/)).toHaveCount(0)
    await expect.poll(() => committedTicket(run, GITHUB_SCOPE, '#609')?.deletedAt).not.toBeNull()
    const after = committedTicket(run, GITHUB_SCOPE, '#609')
    assert.equal(after?.argoId, deleted.argoId)
    assert.equal(after?.title, deleted.title)
  })
}

// ENG-2 is deleted and ENG-1 is done, so the next complete scan lists neither.
export async function proveLinearMissing(run: Run) {
  await row(run, /^ENG-2/).waitFor()
  const deleted = committedTicket(run, LINEAR_SCOPE, 'issue-ENG-2')
  assert.ok(deleted)
  const team = structuredClone(TEAM)
  team.issues = team.issues.filter((issue) => issue.identifier !== 'ENG-2')
  const mill = team.issues.find((issue) => issue.identifier === 'ENG-1')
  if (mill) Object.assign(mill, { status: 'Done', stateType: 'completed' })
  const rescan = async () => {
    await openRoom(run.page, 'atlas')
    await openRoom(run.page, 'tickets')
  }

  await test.step('linear-failed-scan-omits-nothing', async () => {
    run.fixture.linear.outage('down')
    run.fixture.linear.addTeam(team)
    await rescan()
    await backlog(run.page).getByRole('alert').getByText('Argo cannot reach Linear.').waitFor()
    await expect(row(run, /^ENG-2/)).toBeVisible()
    assert.equal(committedTicket(run, LINEAR_SCOPE, 'issue-ENG-2')?.deletedAt, null)
    assert.equal(committedTicket(run, LINEAR_SCOPE, 'issue-ENG-1')?.state, 'open')
  })
  await test.step('linear-moved-state-and-confirmed-deletion', async () => {
    run.fixture.linear.outage('none')
    await rescan()
    await expect(row(run, /^ENG-1/)).toHaveCount(0)
    await expect(row(run, /^ENG-2/)).toHaveCount(0)
    await expect
      .poll(() => committedTicket(run, LINEAR_SCOPE, 'issue-ENG-2')?.deletedAt)
      .not.toBeNull()
    await expect.poll(() => committedTicket(run, LINEAR_SCOPE, 'issue-ENG-1')?.state).toBe('closed')
    assert.equal(committedTicket(run, LINEAR_SCOPE, 'issue-ENG-1')?.deletedAt, null)
    const after = committedTicket(run, LINEAR_SCOPE, 'issue-ENG-2')
    assert.equal(after?.argoId, deleted.argoId)
    assert.equal(after?.title, deleted.title)
  })
}
