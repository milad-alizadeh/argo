// The Ticket proof's linked Tickets (#2871): an Argo link opens a Ticket the active list does not
// hold, the by-ID read commits it to SQLite, and the saved row answers after the list moves on.
import assert from 'node:assert/strict'
import { expect, test } from '@playwright/test'
import type { Page } from 'playwright-core'
import { helloWorld } from '../fixtures/tickets.fixture'
import { backlog, committedTicketIds, detailTitle, openRoom, type Run } from '../screen'

const GITHUB_SCOPE = { provider: 'github', scope: 'octocat/hello-world' }
const LINEAR_SCOPE = { provider: 'linear', scope: 'team-engine' }

// An Argo link, as a Session's "Open Ticket" or a composer reference follows it.
async function openLink(page: Page, reference: string) {
  await page.evaluate(
    (hash) => {
      window.location.hash = hash
    },
    `#/projects/project-1/tickets/${encodeURIComponent(reference)}`,
  )
}

const detail = (run: Run, key: string) => run.page.getByRole('article', { name: `Ticket ${key}` })

// #388 is closed, so no active scan lists it; #273 later leaves the active list.
export async function proveGitHubLinkedTicket(run: Run) {
  await backlog(run.page).getByRole('button', { name: /^#273/ }).waitFor()
  await test.step('github-link-outside-backlog', async () => {
    assert.equal(committedTicketIds(run, GITHUB_SCOPE)['#388'], undefined)
    await openLink(run.page, '#388')
    await detailTitle(detail(run, '#388'), 'Ticket read path').waitFor()
    await detail(run, '#388').getByText('Closed as completed').waitFor()
    assert.ok(committedTicketIds(run, GITHUB_SCOPE)['#388'])
  })
  await test.step('github-link-by-argo-id', async () => {
    const argoId = committedTicketIds(run, GITHUB_SCOPE)['#273']
    assert.ok(argoId)
    await openLink(run.page, argoId)
    await detailTitle(detail(run, '#273'), 'The Next-up planner').waitFor()
  })
  await test.step('github-link-after-list-changes', async () => {
    const repository = helloWorld()
    const planner = repository.issues.find((issue) => issue.number === 273)
    if (planner) planner.state = 'closed'
    run.fixture.github.addRepository(repository)
    await openRoom(run.page, 'atlas')
    await openRoom(run.page, 'tickets')
    await expect(backlog(run.page).getByRole('button', { name: /^#273/ })).toHaveCount(0)
    // With GitHub down, only SQLite can answer the link.
    run.fixture.github.outage('down')
    await openLink(run.page, '#273')
    await detailTitle(detail(run, '#273'), 'The Next-up planner').waitFor()
  })
}

// ENG-3 is done, so the active Linear scan never lists it.
export async function proveLinearLinkedTicket(run: Run) {
  await backlog(run.page)
    .getByRole('button', { name: /^ENG-1/ })
    .waitFor()
  await test.step('linear-link-outside-backlog', async () => {
    assert.equal(committedTicketIds(run, LINEAR_SCOPE)['issue-ENG-3'], undefined)
    await openLink(run.page, 'ENG-3')
    await detailTitle(detail(run, 'ENG-3'), 'Cast the gears').waitFor()
    await detail(run, 'ENG-3').getByText('Done').waitFor()
    assert.ok(committedTicketIds(run, LINEAR_SCOPE)['issue-ENG-3'])
  })
  await test.step('linear-link-by-argo-id', async () => {
    const argoId = committedTicketIds(run, LINEAR_SCOPE)['issue-ENG-3']
    assert.ok(argoId)
    await openLink(run.page, 'ENG-1')
    await detail(run, 'ENG-1').waitFor()
    await openLink(run.page, argoId)
    await detailTitle(detail(run, 'ENG-3'), 'Cast the gears').waitFor()
  })
}
