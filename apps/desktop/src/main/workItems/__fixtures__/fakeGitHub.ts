import type { Http, HttpRequest, HttpResponse } from '../http'

// A GitHub in memory, shaped like the one the adapter really talks to. It exists so the port's
// suite asserts provider behaviour THROUGH the canonical interface rather than around it: a
// test states the issues a repository holds, and the only thing it can observe is what
// `read()` returns.

export const API_BASE = 'https://api.test'
export const OWNER = 'milad-alizadeh'
export const REPOSITORY = 'argo'

export interface FakeIssue {
  id: number
  number: number
  title: string
  state: 'open' | 'closed'
  state_reason?: string | null
  type?: { name: string } | null
  assignee?: { login: string } | null
  labels?: string[]
  updated_at?: string
  pull_request?: Record<string, never>
}

export interface FakeRepository {
  issues: FakeIssue[]
  /** Parent issue number → the sub-issue numbers it holds, in the author order the provider
   * would return them. */
  subIssues?: Record<number, number[]>
  /** Issue number → the issue numbers blocking it. */
  blockedBy?: Record<number, number[]>
  /** Endpoints this fake repository refuses, keyed by the path fragment that identifies them —
   * a plan without issue dependencies, or a revoked grant. */
  refuse?: { fragment: string; status: number; message: string }
}

export interface FakeGitHub {
  http: Http
  /** Every request the adapter made, in order — enough to assert that a poll asked
   * conditionally and that it never shelled out. */
  requests: HttpRequest[]
}

export function fakeGitHub(repository: FakeRepository): FakeGitHub {
  const requests: HttpRequest[] = []

  const http: Http = (request) => {
    requests.push(request)
    return Promise.resolve(respond(repository, request))
  }
  return { http, requests }
}

function respond(repository: FakeRepository, request: HttpRequest): HttpResponse {
  const { refuse } = repository
  if (refuse !== undefined && request.url.includes(refuse.fragment)) {
    return { status: refuse.status, body: { message: refuse.message }, headers: {} }
  }
  return { status: 200, body: route(repository, request.url), headers: {} }
}

function route(repository: FakeRepository, url: string): unknown {
  const subIssues = /\/issues\/(\d+)\/sub_issues/.exec(url)
  if (subIssues?.[1] !== undefined) {
    return byNumber(repository, repository.subIssues?.[Number(subIssues[1])] ?? [])
  }
  const blockedBy = /\/issues\/(\d+)\/dependencies\/blocked_by/.exec(url)
  if (blockedBy?.[1] !== undefined) {
    return byNumber(repository, repository.blockedBy?.[Number(blockedBy[1])] ?? [])
  }
  return repository.issues.map((issue) => toPayload(issue, repository))
}

function byNumber(repository: FakeRepository, numbers: number[]): unknown[] {
  return numbers.flatMap((number) => {
    const issue = repository.issues.find((candidate) => candidate.number === number)
    return issue === undefined ? [] : [toPayload(issue, repository)]
  })
}

// The subset of GitHub's issue payload the adapter reads, spelled the way GitHub spells it —
// snake_case keys and all — so the parser is exercised rather than bypassed. The sub-issue
// SUMMARY is derived from the same map that serves the sub-issue endpoint, because on the real
// provider the two can never disagree.
function toPayload(issue: FakeIssue, repository: FakeRepository): Record<string, unknown> {
  const children = repository.subIssues?.[issue.number] ?? []
  return {
    sub_issues_summary: { total: children.length, completed: 0, percent_completed: 0 },
    id: issue.id,
    number: issue.number,
    title: issue.title,
    html_url: `https://github.com/${OWNER}/${REPOSITORY}/issues/${issue.number}`,
    state: issue.state,
    state_reason: issue.state_reason ?? null,
    type: issue.type ?? null,
    assignee: issue.assignee ?? null,
    labels: (issue.labels ?? []).map((name) => ({ name })),
    updated_at: issue.updated_at ?? '2026-08-01T10:00:00Z',
    ...(issue.pull_request === undefined ? {} : { pull_request: issue.pull_request }),
  }
}
