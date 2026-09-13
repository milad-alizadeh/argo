// Linear as a Ticket source: a team is the scope, and its open issues are the Tickets.
import type { SourceFailure, TicketSource } from '../../core/tickets/sources'
import type { LinearFailure } from './http'
import { readTicketPage } from './issues'
import { checkTeam, listTeams } from './teams'

const FAILURES: Record<LinearFailure | 'team-not-visible', SourceFailure> = {
  unauthorized: 'refused',
  forbidden: 'team-not-visible',
  'rate-limited': 'linear-rate-limited',
  unreachable: 'linear-unreachable',
  'team-not-visible': 'team-not-visible',
}

const failed = (failure: LinearFailure | 'team-not-visible') =>
  ({ ok: false, failure: FAILURES[failure] }) as const

// A build without Linear's endpoints has no Linear Account to read through; a stored one reaches
// nothing.
const UNREACHABLE = failed('unreachable')

export const linearTickets: TicketSource = {
  outage: { 'rate-limited': 'linear-rate-limited', unreachable: 'linear-unreachable' },

  // The team is stored by its id, which survives a rename; its name is what a person reads.
  async check({ endpoints, token }, scope) {
    if (!endpoints.linear) return UNREACHABLE
    const check = await checkTeam(endpoints.linear, token, scope)
    if (!check.ok) return failed(check.failure)
    return { ok: true, value: { scope: check.team.id, label: check.team.name } }
  },

  async discover({ endpoints, token }) {
    if (!endpoints.linear) return UNREACHABLE
    const read = await listTeams(endpoints.linear, token)
    if (!read.ok) return failed(read.failure)
    return { ok: true, value: read.value.map((team) => ({ scope: team.id, label: team.name })) }
  },

  async page({ endpoints, token }, request) {
    if (!endpoints.linear) return UNREACHABLE
    const read = await readTicketPage(endpoints.linear, token, request)
    return read.ok ? read : failed(read.failure)
  },
}
