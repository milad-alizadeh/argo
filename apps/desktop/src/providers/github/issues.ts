// The Ticket port filled by GitHub Issues: one Binding's open Tickets with their hierarchy and
// dependencies (CONTEXT.md L1 · Ticket). Parsed here, at the edge, and nowhere else.
import { isRecord } from '../../boundary'
import type { Ticket, TicketLabel, TicketLink } from '../../core/tickets/contract'
import type { GitHubEndpoints } from './endpoints'
import { type GitHubRead, getAll } from './http'

// Tickets read at once. Each reads its edges one after another, so this is also the number of
// requests in flight, bounded because GitHub's secondary limits refuse a wide fan-out.
const CONCURRENT_TICKETS = 8

type Issue = {
  ticket: Omit<Ticket, 'children' | 'blockedBy'>
  hasChildren: boolean
  hasBlockers: boolean
  // GitHub serves no dependency summary where it exposes no dependency edges at all, and that
  // silence is `blockedBy: null` rather than an empty list.
  servesDependencies: boolean
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

function label(value: unknown): TicketLabel | null {
  if (typeof value === 'string') return { name: value, color: null }
  if (!isRecord(value) || typeof value.name !== 'string') return null
  return { name: value.name, color: typeof value.color === 'string' ? value.color : null }
}

function count(summary: unknown, key: string): number {
  return isRecord(summary) && typeof summary[key] === 'number' ? summary[key] : 0
}

// GitHub serves pull requests from `/issues` too, and a Delivery is not a Ticket (CONTEXT.md L1).
function issue(value: unknown): Issue | null {
  if (!isRecord(value) || Object.hasOwn(value, 'pull_request')) return null
  const { number, title, body, state } = value
  if (!isNumber(number) || typeof title !== 'string') return null
  if (state !== 'open' && state !== 'closed') return null
  const prose = typeof body === 'string' ? body.trim() : ''
  const labels = Array.isArray(value.labels) ? value.labels.map(label) : []
  return {
    ticket: {
      number,
      title,
      body: prose === '' ? null : prose,
      state,
      stateReason: typeof value.state_reason === 'string' ? value.state_reason : null,
      labels: labels.filter((entry) => entry !== null),
      type: isRecord(value.type) && typeof value.type.name === 'string' ? value.type.name : null,
    },
    hasChildren: count(value.sub_issues_summary, 'total') > 0,
    hasBlockers: count(value.issue_dependencies_summary, 'total_blocked_by') > 0,
    servesDependencies: isRecord(value.issue_dependencies_summary),
  }
}

function links(values: unknown[]): TicketLink[] {
  return values.flatMap((value) => {
    if (!isRecord(value) || !isNumber(value.number) || typeof value.title !== 'string') return []
    if (value.state !== 'open' && value.state !== 'closed') return []
    return [{ number: value.number, title: value.title, state: value.state }]
  })
}

type Reader = { base: string; token: string }

const NONE: GitHubRead<unknown[]> = { ok: true, value: [] }
const edges = (present: boolean, url: string, token: string) =>
  present ? getAll(url, token) : Promise.resolve(NONE)

// The edges are asked for only where the issue's own summary says one exists: the summaries
// carry counts, never numbers.
async function withEdges(reader: Reader, read: Issue): Promise<GitHubRead<Ticket>> {
  const path = `${reader.base}/issues/${read.ticket.number}`
  const children = await edges(read.hasChildren, `${path}/sub_issues`, reader.token)
  if (!children.ok) return children
  const blockers = await edges(read.hasBlockers, `${path}/dependencies/blocked_by`, reader.token)
  if (!blockers.ok) return blockers
  return {
    ok: true,
    value: {
      ...read.ticket,
      children: links(children.value),
      blockedBy: read.servesDependencies ? links(blockers.value) : null,
    },
  }
}

// Back in the order GitHub served them: the backlog draws in the provider's own order.
async function inBatches(reader: Reader, issues: Issue[]): Promise<GitHubRead<Ticket[]>> {
  const tickets: Ticket[] = []
  for (let start = 0; start < issues.length; start += CONCURRENT_TICKETS) {
    const batch = issues.slice(start, start + CONCURRENT_TICKETS)
    const reads = await Promise.all(batch.map((entry) => withEdges(reader, entry)))
    for (const read of reads) {
      if (!read.ok) return read
      tickets.push(read.value)
    }
  }
  return { ok: true, value: tickets }
}

export async function readOpenTickets(
  endpoints: GitHubEndpoints,
  token: string,
  scope: string,
): Promise<GitHubRead<Ticket[]>> {
  const reader = { base: `${endpoints.api}/repos/${scope}`, token }
  const listing = await getAll(`${reader.base}/issues?state=open`, token)
  if (!listing.ok) return listing
  const issues = listing.value.map(issue).filter((entry) => entry !== null)
  return inBatches(reader, issues)
}
