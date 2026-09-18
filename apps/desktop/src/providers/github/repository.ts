// Can this Account see this repository, and does the repository source Tickets? Asked when a
// repository is connected, the only moment a wrong Account and a missing Ticket can be told
// apart (ADR-0018).
import { isRecord } from '@/boundary'
import type { GitHubEndpoints } from './endpoints'
import { failed, type GitHubFailure, type GitHubRead, get, getAll } from './http'

export type RepositoryCheck =
  | { ok: true; fullName: string }
  | { ok: false; failure: GitHubFailure | 'issues-disabled' }

// GitHub's own rules for an owner and a repository name.
const SCOPE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/

export function isRepositoryScope(value: string): boolean {
  return SCOPE.test(value) && !value.endsWith('/.') && !value.endsWith('/..')
}

type Repository = { fullName: string; hasIssues: boolean }

// GitHub's repository record, or null when its name is not one a repository can have.
function parseRepository(value: unknown): Repository | null {
  if (!isRecord(value) || typeof value.full_name !== 'string') return null
  if (!isRepositoryScope(value.full_name)) return null
  return { fullName: value.full_name, hasIssues: value.has_issues === true }
}

export async function checkRepository(
  endpoints: GitHubEndpoints,
  token: string,
  scope: string,
): Promise<RepositoryCheck> {
  const reply = await get(`${endpoints.api}/repos/${scope}`, token)
  if (!reply.ok) return reply
  const repository = parseRepository(reply.value)
  if (!repository) return failed('unreachable')
  // A repository with Issues off is visible and sources nothing, which after connect time reads the
  // same as one nobody has filed anything in.
  if (!repository.hasIssues) return { ok: false, failure: 'issues-disabled' }
  return { ok: true, fullName: repository.fullName }
}

// Every repository the Account holds read access to, by owner, collaboration or organization,
// in GitHub's `full_name` order. One with Issues off is left out: connecting it is refused.
export async function listRepositories(
  endpoints: GitHubEndpoints,
  token: string,
): Promise<GitHubRead<string[]>> {
  const reply = await getAll(`${endpoints.api}/user/repos`, token)
  if (!reply.ok) return reply
  const scopes = reply.value.flatMap((value) => {
    const repository = parseRepository(value)
    return repository?.hasIssues ? [repository.fullName] : []
  })
  return { ok: true, value: scopes }
}
