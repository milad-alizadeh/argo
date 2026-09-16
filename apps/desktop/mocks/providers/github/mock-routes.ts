// Every request the mock GitHub answers, routed: the device flow, then the signed-in user, the
// repositories it can see and repository reads.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { accessToken, deviceCode, enterCode } from './mock-device-flow'
import { type Exchange, type MockState, send } from './mock-exchange'
import type { MockIssue, MockRepository, MockUser } from './mock-github'

function issueJson(repository: MockRepository, issue: MockIssue) {
  const blockedBy = issue.blockedBy?.length ?? 0
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? null,
    state: issue.state ?? 'open',
    state_reason: issue.stateReason ?? null,
    created_at: issue.createdAt ?? '2026-01-01T00:00:00Z',
    labels: issue.labels ?? [],
    type: issue.type ? { name: issue.type } : null,
    sub_issues_summary: { total: issue.children?.length ?? 0 },
    ...(repository.servesDependencies === false
      ? {}
      : { issue_dependencies_summary: { total_blocked_by: blockedBy } }),
    ...(issue.pullRequest ? { pull_request: {} } : {}),
  }
}

type Wrap = (slice: unknown[]) => unknown
const bare: Wrap = (slice) => slice

// GitHub's own paging: `per_page` and `page`, with the next page named in a Link header.
function page({ response, url }: Exchange, items: unknown[], wrap: Wrap = bare) {
  const size = Number(url.searchParams.get('per_page') ?? 30)
  const number = Number(url.searchParams.get('page') ?? 1)
  if (number * size < items.length) {
    const next = new URL(url)
    next.searchParams.set('page', String(number + 1))
    response.setHeader('Link', `<${next.href}>; rel="next"`)
  }
  send(response, 200, wrap(items.slice((number - 1) * size, number * size)))
}

const isOpen = (issue: MockIssue) => (issue.state ?? 'open') === 'open'

// The qualifiers the cockpit sends, and every other term matched against title and body.
function search(exchange: Exchange, user: MockUser) {
  const terms = (exchange.url.searchParams.get('q') ?? '').split(' ')
  const scope = terms.find((term) => term.startsWith('repo:'))?.slice('repo:'.length) ?? ''
  const repository = exchange.state.repositories.get(scope.toLowerCase())
  if (!repository?.visibleTo.includes(user.id)) {
    return send(exchange.response, 422, { message: 'Validation Failed' })
  }
  const words = terms.filter((term) => !term.includes(':')).map((term) => term.toLowerCase())
  const matches = repository.issues.filter((issue) => {
    const text = `${issue.title} ${issue.body ?? ''}`.toLowerCase()
    return !issue.pullRequest && isOpen(issue) && words.every((word) => text.includes(word))
  })
  const items = matches.map((issue) => issueJson(repository, issue))
  page(exchange, items, (slice) => ({
    total_count: items.length,
    incomplete_results: false,
    items: slice,
  }))
}

// GitHub's default order for this listing is `full_name`, case-insensitive.
function visibleRepositories(exchange: Exchange, user: MockUser) {
  const visible = [...exchange.state.repositories.entries()]
    .filter(([, repository]) => repository.visibleTo.includes(user.id))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, repository]) => ({
      full_name: repository.fullName,
      has_issues: repository.hasIssues ?? true,
    }))
  page(exchange, visible)
}

const REPOSITORY_PATH =
  /^\/repos\/([^/]+\/[^/]+)(?:\/issues(?:\/(\d+)\/(sub_issues|dependencies\/blocked_by))?)?$/

function repositoryRead(exchange: Exchange, user: MockUser) {
  const { state, response, url } = exchange
  const match = url.pathname.match(REPOSITORY_PATH)
  const repository = match?.[1] ? state.repositories.get(match[1].toLowerCase()) : undefined
  if (!(match && repository?.visibleTo.includes(user.id))) {
    return send(response, 404, { message: 'Not Found' })
  }
  const all = (issue: MockIssue) => issueJson(repository, issue)
  if (!url.pathname.includes('/issues')) {
    const hasIssues = repository.hasIssues ?? true
    return send(response, 200, { full_name: repository.fullName, has_issues: hasIssues })
  }
  if (!match[2]) {
    return page(exchange, repository.issues.filter(isOpen).map(all))
  }
  const parent = repository.issues.find((issue) => issue.number === Number(match[2]))
  const numbers = (match[3] === 'sub_issues' ? parent?.children : parent?.blockedBy) ?? []
  page(exchange, repository.issues.filter((issue) => numbers.includes(issue.number)).map(all))
}

function apiRead(exchange: Exchange) {
  const { state, request, response, url } = exchange
  if (state.outage === 'down') return send(response, 503, { message: 'Unavailable' })
  if (state.outage === 'rate-limited') {
    response.setHeader('x-ratelimit-remaining', '0')
    return send(response, 403, { message: 'API rate limit exceeded' })
  }
  const user = state.tokens.get(request.headers.authorization?.replace(/^Bearer /, '') ?? '')
  if (!user) return send(response, 401, { message: 'Bad credentials' })
  if (url.pathname === '/user') return send(response, 200, { id: user.id, login: user.login })
  if (url.pathname === '/search/issues') return search(exchange, user)
  if (url.pathname === '/user/repos') return visibleRepositories(exchange, user)
  repositoryRead(exchange, user)
}

const ISSUE_PATH = /^\/repos\/([^/]+\/[^/]+)\/issues\/(\d+)$/

// GitHub's issue update, as far as the cockpit sends it: a state, and a reason for closing.
async function issueWrite(exchange: Exchange) {
  const { state, request, response, url } = exchange
  const user = state.tokens.get(request.headers.authorization?.replace(/^Bearer /, '') ?? '')
  if (!user) return send(response, 401, { message: 'Bad credentials' })
  const match = url.pathname.match(ISSUE_PATH)
  const repository = match?.[1] ? state.repositories.get(match[1].toLowerCase()) : undefined
  const issue = repository?.issues.find((candidate) => candidate.number === Number(match?.[2]))
  if (!(repository?.visibleTo.includes(user.id) && issue)) {
    return send(response, 404, { message: 'Not Found' })
  }
  if (!(repository.writers ?? repository.visibleTo).includes(user.id)) {
    return send(response, 403, { message: 'Must have admin rights to Repository.' })
  }
  let text = ''
  for await (const chunk of request) text += chunk
  const change = JSON.parse(text) as Pick<MockIssue, 'state'> & { state_reason?: string }
  issue.state = change.state ?? issue.state
  issue.stateReason =
    issue.state === 'open' ? null : (change.state_reason as MockIssue['stateReason'])
  send(response, 200, issueJson(repository, issue))
}

export async function answer(state: MockState, request: IncomingMessage, response: ServerResponse) {
  const exchange = { state, request, response, url: new URL(request.url ?? '/', state.origin) }
  const route = `${request.method} ${exchange.url.pathname}`
  if (route === 'POST /login/device/code') return deviceCode(exchange)
  if (route === 'POST /login/oauth/access_token') return accessToken(exchange)
  if (route === 'GET /login/device') return enterCode(exchange)
  if (request.method === 'GET') return apiRead(exchange)
  if (request.method === 'PATCH') return issueWrite(exchange)
  send(response, 405, { message: 'Method not allowed' })
}
