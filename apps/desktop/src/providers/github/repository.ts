// Can this Account see this repository, and does the repository source Tickets? Asked when a
// repository is connected, the only moment a wrong Account and a missing Ticket can be told
// apart (ADR-0018).
import { isRecord } from '../../boundary'
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

export async function checkRepository(
  endpoints: GitHubEndpoints,
  token: string,
  scope: string,
): Promise<RepositoryCheck> {
  const reply = await get(`${endpoints.api}/repos/${scope}`, token)
  if (!reply.ok) return reply
  const repository = reply.value
  if (!isRecord(repository) || typeof repository.full_name !== 'string') {
    return failed('unreachable')
  }
  if (!isRepositoryScope(repository.full_name)) return failed('unreachable')
  // A repository with Issues off is visible and sources nothing, which after connect time reads the
  // same as one nobody has filed anything in.
  if (repository.has_issues !== true) return { ok: false, failure: 'issues-disabled' }
  return { ok: true, fullName: repository.full_name }
}

// Every repository the Account holds read access to, by owner, collaboration or organization,
// in GitHub's `full_name` order. One with Issues off is left out: connecting it is refused.
export async function listRepositories(
  endpoints: GitHubEndpoints,
  token: string,
): Promise<GitHubRead<string[]>> {
  const reply = await getAll(`${endpoints.api}/user/repos`, token)
  if (!reply.ok) return reply
  const scopes = reply.value.flatMap((repository) =>
    isRecord(repository) &&
    typeof repository.full_name === 'string' &&
    isRepositoryScope(repository.full_name) &&
    repository.has_issues === true
      ? [repository.full_name]
      : [],
  )
  return { ok: true, value: scopes }
}
