import type { WorkItemView } from '../../../shared'
import { createGitHubWorkItems } from '../github/adapter'
import type { WorkItemProvider, WorkItemRead } from '../port'
import {
  API_BASE,
  type FakeGitHub,
  type FakeRepository,
  fakeGitHub,
  OWNER,
  REPOSITORY,
} from './fakeGitHub'

// The port's suite reaches the adapter only through this: a repository stated as data, a
// provider built over the fake transport, and `read()` — the canonical interface — as the one
// thing a test may observe.

/** An open leaf, the shape most cases vary one field of. */
export const OPEN_ISSUE = { id: 1001, number: 12, title: 'Ship the port', state: 'open' } as const

export function gitHubPort(repository: FakeRepository): {
  provider: WorkItemProvider
  github: FakeGitHub
} {
  const github = fakeGitHub(repository)
  const provider = createGitHubWorkItems({
    projectId: 'p-argo',
    owner: OWNER,
    repository: REPOSITORY,
    http: github.http,
    token: 'gho_test',
    apiBase: API_BASE,
  })
  return { provider, github }
}

export function readPort(repository: FakeRepository): Promise<WorkItemRead> {
  return gitHubPort(repository).provider.read()
}

/** The items a successful read returned. A refused read is a test failure carrying the
 * provider's own reason, which is more use than an empty array. */
export async function readItems(repository: FakeRepository): Promise<WorkItemView[]> {
  const result = await readPort(repository)
  if (!result.ok) throw new Error(`expected a successful read, got: ${result.detail}`)
  return result.items
}
