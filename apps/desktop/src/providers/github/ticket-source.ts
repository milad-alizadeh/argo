// GitHub as a Ticket source: a repository is the scope, and its Issues are the Tickets.
import type { SourceFailure, TicketSource } from '../../core/tickets/sources'
import type { GitHubFailure } from './http'
import { readTicketPage } from './issues'
import { checkRepository, isRepositoryScope, listRepositories } from './repository'

const FAILURES: Record<GitHubFailure | 'issues-disabled', SourceFailure> = {
  unauthorized: 'refused',
  forbidden: 'repository-not-visible',
  'not-found': 'repository-not-visible',
  'rate-limited': 'rate-limited',
  unreachable: 'github-unreachable',
  'issues-disabled': 'issues-disabled',
}

const failed = (failure: GitHubFailure | 'issues-disabled') =>
  ({ ok: false, failure: FAILURES[failure] }) as const

// GitHub pages by number, so its cursor is the page number written out.
const PAGE_CURSOR = /^[1-9]\d{0,5}$/

export const githubTickets: TicketSource = {
  outage: { 'rate-limited': 'rate-limited', unreachable: 'github-unreachable' },

  // GitHub's canonical name is what is stored, so the Connection survives a person's casing.
  async check({ endpoints, token }, scope) {
    if (!isRepositoryScope(scope)) return { ok: false, failure: 'invalid-scope' }
    const check = await checkRepository(endpoints.github, token, scope)
    if (!check.ok) return failed(check.failure)
    return { ok: true, value: { scope: check.fullName, label: check.fullName } }
  },

  async discover({ endpoints, token }) {
    const read = await listRepositories(endpoints.github, token)
    if (!read.ok) return failed(read.failure)
    return { ok: true, value: read.value.map((name) => ({ scope: name, label: name })) }
  },

  async page({ endpoints, token }, { scope, query, cursor }) {
    if (cursor !== null && !PAGE_CURSOR.test(cursor))
      return { ok: false, failure: 'invalid-request' }
    const page = cursor === null ? 1 : Number(cursor)
    const read = await readTicketPage(endpoints.github, token, { scope, query, page })
    if (!read.ok) return failed(read.failure)
    const { tickets, nextPage, total } = read.value
    const nextCursor = nextPage === null ? null : String(nextPage)
    return { ok: true, value: { tickets, nextCursor, total } }
  },
}
