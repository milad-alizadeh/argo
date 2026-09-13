import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TICKET_PAGE_SIZE } from '../../core/tickets/contract'
import { github, OCTOCAT, signIn } from './harness'
import { readTicketPage, searchQuery } from './issues'

test('a backlog reads one page at a time and names the next until it ends', async (context) => {
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT)
  const issues = Array.from({ length: TICKET_PAGE_SIZE + 5 }, (_, index) => ({
    number: index + 1,
    title: `T${index}`,
  }))
  fake.addRepository({ fullName: 'octo/big', visibleTo: [OCTOCAT.id], issues })
  const token = await signIn(endpoints)
  const first = await readTicketPage(endpoints, token, { scope: 'octo/big', query: '', page: 1 })
  assert.ok(first.ok)
  assert.equal(first.value.tickets.length, TICKET_PAGE_SIZE)
  assert.equal(first.value.nextPage, 2)
  const last = await readTicketPage(endpoints, token, { scope: 'octo/big', query: '', page: 2 })
  assert.ok(last.ok)
  assert.deepEqual(
    last.value.tickets.map((ticket) => ticket.key),
    ['#26', '#27', '#28', '#29', '#30'],
  )
  assert.equal(last.value.nextPage, null)
})

test('a search is answered by GitHub, counted, and kept to open issues of this repository', async (context) => {
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT)
  fake.addRepository({
    fullName: 'octo/hello',
    visibleTo: [OCTOCAT.id],
    issues: [
      { number: 1, title: 'Parent' },
      { number: 2, title: 'Open child' },
      { number: 3, title: 'Closed child', state: 'closed' },
    ],
  })
  const token = await signIn(endpoints)
  const read = await readTicketPage(endpoints, token, {
    scope: 'octo/hello',
    query: 'child',
    page: 1,
  })
  assert.ok(read.ok)
  assert.deepEqual(
    read.value.tickets.map((ticket) => ticket.key),
    ['#2'],
  )
  assert.equal(read.value.total, 1)
  assert.ok(fake.requests.includes('GET /search/issues'))
})

test('a typed qualifier cannot widen a search past the open issues of the repository', () => {
  assert.equal(
    searchQuery('octo/hello', '  crash repo:octo/secret -is:open state:closed in:body label:bug '),
    'crash label:bug repo:octo/hello is:issue is:open',
  )
})
