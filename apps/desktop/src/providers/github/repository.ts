// Can this Account see this repository, and does the repository source Tickets? Asked at bind
// time, the only moment a wrong Account and a missing Ticket can be told apart (ADR-0018).
import { isRecord } from '../../boundary'
import type { GitHubEndpoints } from './endpoints'
import { failed, type GitHubFailure, get } from './http'

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
  // A repository with Issues off is visible and sources nothing, which after bind time reads the
  // same as one nobody has filed anything in.
  if (repository.has_issues !== true) return { ok: false, failure: 'issues-disabled' }
  return { ok: true, fullName: repository.full_name }
}
