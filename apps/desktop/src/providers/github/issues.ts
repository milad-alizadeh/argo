// The Ticket port filled by GitHub Issues: one Connection's open Tickets with their hierarchy and
// dependencies (CONTEXT.md L1 · Ticket). Parsed here, at the edge, and nowhere else.

import { TICKET_PAGE_SIZE } from '@/domains/tickets/contract/contract'
import {
  labelColor,
  type Ticket,
  type TicketLabel,
  type TicketLink,
  type TicketStatus,
} from '@/domains/tickets/contract/ticket'
import type { GitHubEndpoints } from '@/providers/github/endpoints'
import { failed, type GitHubRead, get, getAll, getPage } from '@/providers/github/http'
import { GITHUB_STATUSES, githubStatus } from '@/providers/github/statuses'
import { isRecord } from '@/shared/validation'

// Tickets read at once. Each reads its edges one after another, so this is also the number of
// requests in flight, bounded because GitHub's secondary limits refuse a wide fan-out.
const CONCURRENT_TICKETS = 8

type Issue = {
  number: number
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
  return { name: value.name, color: labelColor(value.color) }
}

function count(summary: unknown, key: string): number {
  return isRecord(summary) && typeof summary[key] === 'number' ? summary[key] : 0
}

const keyOf = (number: number) => `#${number}`

// GitHub serves pull requests from `/issues` too, and a Delivery is not a Ticket (CONTEXT.md L1).
function issue(value: unknown, page: string): Issue | null {
  if (!isRecord(value) || Object.hasOwn(value, 'pull_request')) return null
  const { number, title, body, state, created_at: createdAt } = value
  if (!isNumber(number) || typeof title !== 'string') return null
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null
  if (state !== 'open' && state !== 'closed') return null
  const prose = typeof body === 'string' ? body.trim() : ''
  const labels = Array.isArray(value.labels) ? value.labels.map(label) : []
  return {
    number,
    ticket: {
      key: keyOf(number),
      url: `${page}/${number}`,
      title,
      body: prose === '' ? null : prose,
      state,
      status: githubStatus(state, value.state_reason),
      // GitHub keeps no priority.
      priority: null,
      createdAt,
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
    return [{ key: keyOf(value.number), title: value.title, state: value.state }]
  })
}

type Reader = { base: string; token: string }

const NONE: GitHubRead<unknown[]> = { ok: true, value: [] }
const edges = (present: boolean, url: string, token: string) =>
  present ? getAll(url, token) : Promise.resolve(NONE)

// The edges are asked for only where the issue's own summary says one exists: the summaries
// carry counts, never numbers.
async function withEdges(reader: Reader, read: Issue): Promise<GitHubRead<Ticket>> {
  const path = `${reader.base}/issues/${read.number}`
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

export type TicketPage = { tickets: Ticket[]; nextPage: number | null; total: number | null }

// The search stays inside this repository's open issues whatever qualifier a person types.
const SCOPING_QUALIFIER = /^-?(repo|org|user|owner|is|state|in):/i

export function searchQuery(scope: string, query: string): string {
  const terms = query.split(/\s+/).filter((term) => term !== '' && !SCOPING_QUALIFIER.test(term))
  return [...terms, `repo:${scope}`, 'is:issue', 'is:open'].join(' ')
}

type Listing = { items: unknown[]; total: number | null }

// A search wraps its items with a count; a backlog listing is the bare array.
function listing(body: unknown): Listing | null {
  if (Array.isArray(body)) return { items: body, total: null }
  if (!isRecord(body) || !Array.isArray(body.items)) return null
  return {
    items: body.items,
    total: typeof body.total_count === 'number' ? body.total_count : null,
  }
}

export type TicketPageRequest = { scope: string; query: string; page: number }
export type TicketReadRequest = { scope: string; key: string }

function pageURL(endpoints: GitHubEndpoints, { scope, query, page }: TicketPageRequest): string {
  const paging = `per_page=${TICKET_PAGE_SIZE}&page=${page}`
  if (query.trim() === '') return `${endpoints.api}/repos/${scope}/issues?state=open&${paging}`
  const search = new URLSearchParams({ q: searchQuery(scope, query) })
  return `${endpoints.api}/search/issues?${search}&${paging}`
}

export async function readTicketPage(
  endpoints: GitHubEndpoints,
  token: string,
  request: TicketPageRequest,
): Promise<GitHubRead<TicketPage>> {
  const read = await getPage(pageURL(endpoints, request), token)
  if (!read.ok) return read
  const served = listing(read.value.body)
  if (!served) return failed('unreachable')
  const page = `${endpoints.web}/${request.scope}/issues`
  const issues = served.items.map((item) => issue(item, page)).filter((entry) => entry !== null)
  const tickets = await inBatches(
    { base: `${endpoints.api}/repos/${request.scope}`, token },
    issues,
  )
  if (!tickets.ok) return tickets
  const nextPage = read.value.next ? request.page + 1 : null
  return { ok: true, value: { tickets: tickets.value, nextPage, total: served.total } }
}

export async function readTicket(
  endpoints: GitHubEndpoints,
  token: string,
  request: TicketReadRequest,
): Promise<GitHubRead<{ ticket: Ticket | null; statuses: TicketStatus[] }>> {
  const match = request.key.match(/^#([1-9]\d{0,8})$/)
  if (!match?.[1]) return { ok: true, value: { ticket: null, statuses: [...GITHUB_STATUSES] } }
  const response = await get(`${endpoints.api}/repos/${request.scope}/issues/${match[1]}`, token)
  if (!response.ok) {
    return response.failure === 'not-found'
      ? { ok: true, value: { ticket: null, statuses: [...GITHUB_STATUSES] } }
      : response
  }
  const found = issue(response.value, `${endpoints.web}/${request.scope}/issues`)
  if (found === null) return { ok: true, value: { ticket: null, statuses: [...GITHUB_STATUSES] } }
  const detail = await withEdges({ base: `${endpoints.api}/repos/${request.scope}`, token }, found)
  return detail.ok
    ? { ok: true, value: { ticket: detail.value, statuses: [...GITHUB_STATUSES] } }
    : detail
}
