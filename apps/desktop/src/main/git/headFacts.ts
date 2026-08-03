import { runGit } from './runGit'

/** Where HEAD stands in the primary checkout: its label, and how far it has drifted. */
export interface HeadFacts {
  branch: string
  ahead: number
  behind: number
}

const HEAD_FACTS_ARGS = ['status', '--porcelain=v2', '--branch', '--untracked-files=no']

const DETACHED = '(detached)'
const SHORT_SHA_LENGTH = 7

export async function readHeadFacts(repoPath: string): Promise<HeadFacts> {
  return parseHeadFacts((await runGit(repoPath, HEAD_FACTS_ARGS)).stdout)
}

// `git status --porcelain=v2 --branch` (grounded on git 2.50.1) heads its output with
// `# branch.oid <sha>`, `# branch.head <name|(detached)>`, and — ONLY when HEAD tracks an
// upstream — `# branch.upstream <ref>` and `# branch.ab +<ahead> -<behind>`. An absent
// `branch.ab` is therefore "no upstream", not "in sync".
export function parseHeadFacts(stdout: string): HeadFacts {
  const headers = readHeaders(stdout)
  const head = headers.get('branch.head') ?? ''
  return {
    // A detached HEAD is on no branch, and the short sha is the only label git can honestly
    // give it (spec: the shell renders that label rather than pretending a branch).
    branch: head === DETACHED ? (headers.get('branch.oid') ?? '').slice(0, SHORT_SHA_LENGTH) : head,
    ...readDrift(headers.get('branch.ab')),
  }
}

function readHeaders(stdout: string): Map<string, string> {
  return new Map(
    stdout.split('\n').flatMap((line) => {
      const header = /^# (branch\.\w+) (.+)$/.exec(line)
      return header === null ? [] : [[header[1] ?? '', header[2] ?? ''] as const]
    }),
  )
}

function readDrift(aheadBehind: string | undefined): { ahead: number; behind: number } {
  const drift = /^\+(\d+) -(\d+)$/.exec(aheadBehind ?? '')
  if (drift === null) return { ahead: 0, behind: 0 }
  return { ahead: Number(drift[1] ?? 0), behind: Number(drift[2] ?? 0) }
}
