// The Ticket proof's search beyond the local index (#2873): saved matches draw before GitHub
// answers, a Ticket only GitHub holds is committed and drawn, and a failed search keeps the saved
// matches beside its failure.
import assert from 'node:assert/strict'
import { expect, test } from '@playwright/test'
import { helloWorld } from '../fixtures/tickets.fixture'
import { backlog, committedTicketIds, openRoom, type Run } from '../screen'

const GITHUB_SCOPE = { provider: 'github', scope: 'octocat/hello-world' }

const row = (run: Run, number: number) =>
  backlog(run.page).getByRole('button', { name: new RegExp(`^#${number}`) })

// The words live in the route, as the field writes them. The sidebar's control is disabled while
// the sidebar holds no Connection (`tickets-sidebar.tsx`), so the route is the way in.
async function search(run: Run, query: string) {
  await run.page.evaluate(
    (hash) => {
      window.location.hash = hash
    },
    `#/projects/project-1/tickets?ticketSearch=1&q=${encodeURIComponent(query)}`,
  )
}

const clearSearch = (run: Run) =>
  run.page.evaluate(() => {
    window.location.hash = '#/projects/project-1/tickets'
  })

export async function proveSearchBeyondIndex(run: Run) {
  await row(run, 273).waitFor()
  await test.step('saved-matches-before-the-provider', async () => {
    const release = run.fixture.github.holdReads()
    await search(run, 'planner')
    await row(run, 273).waitFor()
    await backlog(run.page).getByText('1 saved match', { exact: true }).waitFor()
    release()
    await backlog(run.page).getByText('1 match', { exact: true }).waitFor()
  })
  await test.step('provider-only-match', async () => {
    const repository = helloWorld()
    repository.issues.push({ number: 730, title: 'Zebra migration' })
    run.fixture.github.addRepository(repository)
    assert.equal(committedTicketIds(run, GITHUB_SCOPE)['#730'], undefined)
    await search(run, 'zebra')
    await row(run, 730).waitFor()
    await backlog(run.page).getByText('1 match', { exact: true }).waitFor()
  })
  await test.step('same-identity-as-the-active-scan', async () => {
    const searched = committedTicketIds(run, GITHUB_SCOPE)['#730']
    assert.ok(searched)
    await clearSearch(run)
    await openRoom(run.page, 'atlas')
    await openRoom(run.page, 'tickets')
    await row(run, 730).waitFor()
    assert.equal(committedTicketIds(run, GITHUB_SCOPE)['#730'], searched)
  })
  await test.step('failed-search-keeps-saved-matches', async () => {
    run.fixture.github.outage('down')
    await search(run, 'next')
    const alert = backlog(run.page).getByRole('alert')
    await alert.getByText('Argo cannot reach GitHub.').waitFor()
    await expect(row(run, 273)).toBeVisible()
    await backlog(run.page).getByText('1 saved match', { exact: true }).waitFor()
  })
}
