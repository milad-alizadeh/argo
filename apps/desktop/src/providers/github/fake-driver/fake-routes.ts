// The endpoints the fake GitHub answers: the device flow, the signed-in user and repository reads.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FakeIssue, FakeOutage, FakeRepository, FakeSignIn, FakeUser } from './fake-github'

export type FakeState = {
  origin: string
  signIn: FakeDevice
  devices: Map<string, FakeDevice>
  tokens: Map<string, FakeUser>
  repositories: Map<string, FakeRepository>
  outage: FakeOutage
  serial: number
}

// A held device stays pending until someone opens the device page, as a person entering the code.
type FakeDevice = { answer: FakeSignIn; pending: number; held: boolean }

type Exchange = { state: FakeState; request: IncomingMessage; response: ServerResponse; url: URL }

// A header set on the response before this call is merged into the one written here.
export function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

async function formOf(request: IncomingMessage): Promise<URLSearchParams> {
  let text = ''
  for await (const chunk of request) text += chunk
  return new URLSearchParams(text)
}

function deviceCode({ state, response }: Exchange) {
  state.serial += 1
  const code = `device-${state.serial}`
  state.devices.set(code, { ...state.signIn })
  send(response, 200, {
    device_code: code,
    user_code: `ABCD-${String(1000 + state.serial)}`,
    verification_uri: `${state.origin}/login/device`,
    expires_in: 900,
    interval: state.signIn.held ? 1 : 0,
  })
}

async function accessToken({ state, request, response }: Exchange) {
  const form = await formOf(request)
  const device = state.devices.get(form.get('device_code') ?? '')
  if (!device) return send(response, 200, { error: 'incorrect_device_code' })
  if (device.held) return send(response, 200, { error: 'authorization_pending' })
  if (device.pending > 0) {
    device.pending -= 1
    return send(response, 200, { error: 'authorization_pending' })
  }
  if (device.answer === 'declined') return send(response, 200, { error: 'access_denied' })
  if (device.answer === 'expired') return send(response, 200, { error: 'expired_token' })
  state.serial += 1
  const token = `token-${device.answer.login}-${state.serial}`
  state.tokens.set(token, device.answer)
  send(response, 200, { access_token: token, token_type: 'bearer', scope: 'repo,read:project' })
}

function enterCode({ state, response }: Exchange) {
  for (const device of state.devices.values()) device.held = false
  response.writeHead(200, { 'Content-Type': 'text/html' })
  response.end('<h1>Device activated</h1>')
}

function issueJson(repository: FakeRepository, issue: FakeIssue) {
  const blockedBy = issue.blockedBy?.length ?? 0
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? null,
    state: issue.state ?? 'open',
    state_reason: null,
    labels: issue.labels ?? [],
    type: issue.type ? { name: issue.type } : null,
    sub_issues_summary: { total: issue.children?.length ?? 0 },
    ...(repository.servesDependencies === false
      ? {}
      : { issue_dependencies_summary: { total_blocked_by: blockedBy } }),
    ...(issue.pullRequest ? { pull_request: {} } : {}),
  }
}

// GitHub's own paging: `per_page` and `page`, with the next page named in a Link header.
function page({ response, url }: Exchange, items: unknown[]) {
  const size = Number(url.searchParams.get('per_page') ?? 30)
  const number = Number(url.searchParams.get('page') ?? 1)
  if (number * size < items.length) {
    const next = new URL(url)
    next.searchParams.set('page', String(number + 1))
    response.setHeader('Link', `<${next.href}>; rel="next"`)
  }
  send(response, 200, items.slice((number - 1) * size, number * size))
}

const REPOSITORY_PATH =
  /^\/repos\/([^/]+\/[^/]+)(?:\/issues(?:\/(\d+)\/(sub_issues|dependencies\/blocked_by))?)?$/

function repositoryRead(exchange: Exchange, user: FakeUser) {
  const { state, response, url } = exchange
  const match = url.pathname.match(REPOSITORY_PATH)
  const repository = match?.[1] ? state.repositories.get(match[1].toLowerCase()) : undefined
  if (!(match && repository?.visibleTo.includes(user.id))) {
    return send(response, 404, { message: 'Not Found' })
  }
  const all = (issue: FakeIssue) => issueJson(repository, issue)
  if (!url.pathname.includes('/issues')) {
    const hasIssues = repository.hasIssues ?? true
    return send(response, 200, { full_name: repository.fullName, has_issues: hasIssues })
  }
  if (!match[2]) {
    const open = repository.issues.filter((issue) => (issue.state ?? 'open') === 'open')
    return page(exchange, open.map(all))
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
  repositoryRead(exchange, user)
}

export async function answer(state: FakeState, request: IncomingMessage, response: ServerResponse) {
  const exchange = { state, request, response, url: new URL(request.url ?? '/', state.origin) }
  const route = `${request.method} ${exchange.url.pathname}`
  if (route === 'POST /login/device/code') return deviceCode(exchange)
  if (route === 'POST /login/oauth/access_token') return accessToken(exchange)
  if (route === 'GET /login/device') return enterCode(exchange)
  if (request.method === 'GET') return apiRead(exchange)
  send(response, 405, { message: 'Method not allowed' })
}
