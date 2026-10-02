// What a code host does for a new worktree: name the repository a git remote points at, and list
// that repository's open pull requests. A provider that hosts no code registers none.
import type { ProviderEndpoints } from '@/providers/endpoints'

export type PullRequest = { number: number; title: string; branch: string }
export type PullRequestFailure = 'refused' | 'not-visible' | 'unreachable'
export type PullRequestRead =
  | { ok: true; value: PullRequest[] }
  | { ok: false; failure: PullRequestFailure }

export type PullRequestSource = {
  // The repository a remote's URL names on this host, or null when the URL names another host.
  repositoryOfRemote(url: string): string | null
  listOpen(
    reader: { endpoints: ProviderEndpoints; token: string },
    repository: string,
  ): Promise<PullRequestRead>
}
