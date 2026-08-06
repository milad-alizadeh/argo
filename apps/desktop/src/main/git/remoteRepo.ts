import { runGit } from './runGit'

// Which repository on the code host a Project's checkout actually is. The Work Item provider
// port needs an owner and a name to read, and the only DIRECT source of them is git's own
// `origin` — asking the user to type what git already knows would be a second answer that can
// disagree with the first.

/** A repository on GitHub, as `origin` names it. */
export interface RemoteRepo {
  owner: string
  repo: string
}

const GITHUB_HOSTS = ['github.com', 'www.github.com']

/**
 * `origin` as an owner/name pair, or `null` when the folder is no repository, has no `origin`,
 * or points somewhere that is not GitHub — all three of which mean the same thing to the
 * caller: no Work Item provider to connect, rendered as not-connected rather than guessed at.
 */
export async function readRemoteRepo(repositoryPath: string): Promise<RemoteRepo | null> {
  const output = await runGit(repositoryPath, ['remote', 'get-url', 'origin'])
  return output.ok ? parseRemoteUrl(output.stdout.trim()) : null
}

/**
 * Both spellings git writes: `https://github.com/owner/repo.git` and the scp-like
 * `git@github.com:owner/repo.git`. Parsed rather than pattern-matched loosely, so a host that
 * merely CONTAINS `github.com` in a path never reads as GitHub.
 */
export function parseRemoteUrl(url: string): RemoteRepo | null {
  const scp = /^[^@/]+@([^:]+):(.+)$/.exec(url)
  if (scp?.[1] !== undefined && scp[2] !== undefined) return onGitHub(scp[1], scp[2])

  try {
    const parsed = new URL(url)
    return onGitHub(parsed.hostname, parsed.pathname)
  } catch {
    return null
  }
}

function onGitHub(host: string, path: string): RemoteRepo | null {
  if (!GITHUB_HOSTS.includes(host.toLowerCase())) return null

  const segments = path
    .replace(/\.git$/, '')
    .split('/')
    .filter(Boolean)
  const [owner, repo] = segments
  if (owner === undefined || repo === undefined || segments.length !== 2) return null
  return { owner, repo }
}
