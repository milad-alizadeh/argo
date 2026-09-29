// The Ticket proof's Closed paging (#2872): opening Closed reads one provider page into SQLite, more
// reads the next, and a failed page keeps the rows already saved. The Closed room has no screen yet,
// so the case asks through the tRPC channel the screen will use and reads what SQLite answers.
import assert from 'node:assert/strict'
import { expect, test } from '@playwright/test'
import type { Page } from 'playwright-core'
import { TEAM } from '../../../mocks/providers/linear/mock-linear-cast'
import { helloWorld } from '../fixtures/tickets.fixture'
import { backlog, type Run } from '../screen'

const PAGE_SIZE = 25
const ADDED = 30
// The ones added here, and the one closed Ticket each provider already serves.
const CLOSED_COUNT = ADDED + 1

type Indexed = {
  type: 'ticket.indexed'
  tickets: { key: string }[]
  total: number
  sync: { phase: string; failure: string | null; complete: boolean }
}
type Envelope = { result?: { data: Indexed }; error?: unknown }

type Call = { path: string; type: 'query' | 'mutation'; input: unknown }

async function call(page: Page, request: Call) {
  return page.evaluate(
    async (sent) => (await window.argo.trpc({ id: 0, ...sent })) as Envelope,
    request,
  )
}

const closedPage = async (page: Page, index: number) => {
  const answer = await call(page, {
    path: 'ticketClosed',
    type: 'query',
    input: { projectId: 'project-1', page: index },
  })
  assert.ok(answer.result, JSON.stringify(answer))
  return answer.result.data
}
const load = (page: Page, more: boolean) =>
  call(page, {
    path: 'ticketClosedLoad',
    type: 'mutation',
    input: { projectId: 'project-1', more },
  })

const savedKeys = async (page: Page) => [
  ...(await closedPage(page, 0)).tickets.map(({ key }) => key),
  ...(await closedPage(page, 1)).tickets.map(({ key }) => key),
]

async function proveClosedPaging(
  run: Run,
  { fail, firstKey, lastKey }: { fail: () => () => void; firstKey: string; lastKey: string },
) {
  const { page } = run
  await test.step('nothing-closed-before-opening', async () => {
    assert.equal((await closedPage(page, 0)).total, 0)
  })
  await test.step('opening-reads-the-first-page', async () => {
    await load(page, false)
    await expect.poll(async () => (await closedPage(page, 0)).sync.phase).toBe('ready')
    const first = await closedPage(page, 0)
    assert.equal(first.tickets.length, PAGE_SIZE)
    assert.equal(first.tickets[0]?.key, firstKey)
    assert.equal(first.sync.complete, false)
  })
  await test.step('a-failed-page-keeps-saved-rows', async () => {
    const recover = fail()
    await load(page, true)
    await expect.poll(async () => (await closedPage(page, 0)).sync.phase).toBe('failed')
    const kept = await closedPage(page, 0)
    assert.equal(kept.total, PAGE_SIZE)
    assert.notEqual(kept.sync.failure, null)
    recover()
  })
  await test.step('more-reads-the-next-page', async () => {
    await load(page, true)
    await expect.poll(async () => (await closedPage(page, 0)).sync.complete).toBe(true)
    const keys = await savedKeys(page)
    assert.equal(keys.length, CLOSED_COUNT)
    assert.equal(keys.at(-1), lastKey)
    assert.equal((await closedPage(page, 0)).sync.failure, null)
  })
}

export async function proveGitHubClosed(run: Run) {
  const repository = helloWorld()
  // Newest first, as GitHub lists them.
  for (let number = 1000; number < 1000 + ADDED; number += 1)
    repository.issues.push({ number, title: `Closed #${number}`, state: 'closed' })
  run.fixture.github.addRepository(repository)
  await backlog(run.page).getByRole('button', { name: /^#273/ }).waitFor()
  await proveClosedPaging(run, {
    firstKey: '#388',
    lastKey: `#${1000 + ADDED - 1}`,
    fail: () => {
      run.fixture.github.outage('down')
      return () => run.fixture.github.outage('none')
    },
  })
}

export async function proveLinearClosed(run: Run) {
  const issues = Array.from({ length: ADDED }, (_, index) => ({
    identifier: `ENG-${100 + index}`,
    title: `Closed ${index}`,
    status: 'Done',
    stateType: 'completed' as const,
  }))
  run.fixture.linear.addTeam({ ...TEAM, issues: [...TEAM.issues, ...issues] })
  await backlog(run.page)
    .getByRole('button', { name: /^ENG-1/ })
    .waitFor()
  await proveClosedPaging(run, {
    firstKey: 'ENG-3',
    lastKey: `ENG-${100 + ADDED - 1}`,
    fail: () => {
      run.fixture.linear.outage('down')
      return () => run.fixture.linear.outage('none')
    },
  })
}
