// A repository's open pull requests, which a new worktree can start from. Parsed here, at the edge.
import type { GitHubFailure } from '@/providers/github/http'
import { getAll } from '@/providers/github/http'
import { isRepositoryScope } from '@/providers/github/repository'
import type {
  PullRequest,
  PullRequestFailure,
  PullRequestSource,
} from '@/providers/pull-request-source'
import { isRecord } from '@/shared/validation'

// `https://github.com/o/r.git`, `ssh://git@github.com/o/r`, and the scp form `git@github.com:o/r`.
const REMOTE =
  /^(?:(?:https?|ssh|git):\/\/(?:[^@/]+@)?github\.com(?::\d+)?\/|[^@/:]+@github\.com:)([^/]+\/[^/]+?)(?:\.git)?\/?$/

const FAILURES: Record<GitHubFailure, PullRequestFailure> = {
  unauthorized: 'refused',
  forbidden: 'not-visible',
  'not-found': 'not-visible',
  'rate-limited': 'unreachable',
  unreachable: 'unreachable',
}

function pullRequest(value: unknown): PullRequest | null {
  if (!isRecord(value) || !isRecord(value.head)) return null
  const { number, title } = value
  const branch = value.head.ref
  if (typeof number !== 'number' || !Number.isInteger(number) || number <= 0) return null
  if (typeof title !== 'string' || typeof branch !== 'string' || branch === '') return null
  return { number, title, branch }
}

export const githubPullRequests: PullRequestSource = {
  repositoryOfRemote(url) {
    const repository = url.trim().match(REMOTE)?.[1]
    return repository !== undefined && isRepositoryScope(repository) ? repository : null
  },

  async listOpen({ endpoints, token }, repository) {
    const read = await getAll(`${endpoints.github.api}/repos/${repository}/pulls?state=open`, token)
    if (!read.ok) return { ok: false, failure: FAILURES[read.failure] }
    return { ok: true, value: read.value.flatMap((value) => pullRequest(value) ?? []) }
  },
}
