// A Ticket's linked Sessions follow the Ticket (#2973): a Claude and a Codex Session linked to #273
// take its title as their name, and take a new title when a scan saves one, with no reload.
import { expect, test } from '@playwright/test'
import { helloWorldRepository as helloWorld } from '@/mocks/tickets/provider-inputs'
import { LINKED_TICKET_KEY } from '../fixtures/linked-sessions.fixture'
import { backlog, detailTitle, type Run, showWindow } from '../screen'

const TITLE = 'The Next-up planner'
const RENAMED = 'The Next-up planner, renamed'

export async function proveLinkedSessionsFollowTicket(run: Run) {
  await showWindow(run.application, true)
  await backlog(run.page).getByRole('button', { name: /^#273/ }).click()
  const detail = run.page.getByRole('article', { name: `Ticket ${LINKED_TICKET_KEY}` })
  const sessions = detail.getByRole('button', { name: /^The Next-up planner/ })
  await test.step('linked-sessions-show-the-ticket-title', async () => {
    await detail.getByText('Linked Sessions · 2').waitFor()
    await expect(sessions).toHaveText([TITLE, TITLE])
  })
  await test.step('linked-sessions-follow-a-renamed-ticket', async () => {
    const repository = helloWorld()
    const planner = repository.issues.find((issue) => issue.number === 273)
    if (planner) planner.title = RENAMED
    run.fixture.github.addRepository(repository)
    await detailTitle(detail, RENAMED).waitFor()
    await expect(sessions).toHaveText([RENAMED, RENAMED])
  })
}
