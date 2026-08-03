import type { BranchRef } from '../../shared'
import { runGit } from './runGit'

const BRANCH_REF_ARGS = [
  'for-each-ref',
  '--format=%(refname)%09%(upstream:short)%09%(upstream:track)',
  'refs/heads',
  'refs/remotes/origin',
]

const LOCAL_PREFIX = 'refs/heads/'
const REMOTE_PREFIX = 'refs/remotes/'
// The symbolic ref recording origin's default branch. It is not a ref anyone checks out, and
// listing it would put a bare `origin` row in the branch menu.
const ORIGIN_HEAD = 'refs/remotes/origin/HEAD'

interface RawRef {
  name: string
  remote: boolean
  upstream: string
  track: string
}

export async function readBranchRefs(repositoryPath: string): Promise<BranchRef[]> {
  return parseBranchRefs((await runGit(repositoryPath, BRANCH_REF_ARGS)).stdout)
}

// One tab-separated line per ref from the format above (grounded on git 2.50.1). `worktreePath`
// is left null here: which worktree holds a branch is a separate read (`worktrees.ts`).
export function parseBranchRefs(stdout: string): BranchRef[] {
  const refs = stdout.split('\n').flatMap(toRawRef)
  return refs.map((ref) => ({
    name: ref.name,
    remote: ref.remote,
    ...(ref.remote ? mirroredDrift(ref, refs) : parseTrack(ref.track)),
    worktreePath: null,
  }))
}

function toRawRef(line: string): RawRef[] {
  const [refname = '', upstream = '', track = ''] = line.split('\t')
  if (refname === ORIGIN_HEAD) return []
  if (refname.startsWith(LOCAL_PREFIX)) {
    return [{ name: refname.slice(LOCAL_PREFIX.length), remote: false, upstream, track }]
  }
  if (refname.startsWith(REMOTE_PREFIX)) {
    return [{ name: refname.slice(REMOTE_PREFIX.length), remote: true, upstream, track }]
  }
  return []
}

// A remote ref tracks nothing of its own, so git reports no drift for it. Its divergence is the
// MIRROR of its counterpart local branch: local ahead 2 means the remote ref is behind 2. A
// remote ref with no counterpart has nothing to be ahead or behind of, and reads 0/0.
function mirroredDrift(ref: RawRef, refs: RawRef[]): { ahead: number; behind: number } {
  const counterpart = ref.name.slice(ref.name.indexOf('/') + 1)
  // Both halves matter: a topic branch may track `origin/main` without being main's counterpart,
  // and mirroring ITS drift onto `origin/main` would report a divergence that does not exist.
  const tracker = refs.find(
    (candidate) =>
      !candidate.remote && candidate.upstream === ref.name && candidate.name === counterpart,
  )
  const local = parseTrack(tracker?.track ?? '')
  return { ahead: local.behind, behind: local.ahead }
}

// `%(upstream:track)` reads `[ahead 2, behind 1]`, `[ahead 2]`, `[behind 1]`, `[gone]` or empty.
// `[gone]` is a deleted upstream: the drift is unknowable rather than zero, and 0/0 is how the
// menu shows "no arrows" — the branch's gone-ness shows through its empty remote counterpart.
function parseTrack(track: string): { ahead: number; behind: number } {
  return { ahead: commitsIn(track, 'ahead'), behind: commitsIn(track, 'behind') }
}

function commitsIn(track: string, direction: string): number {
  const count = new RegExp(`${direction} (\\d+)`).exec(track)
  return count === null ? 0 : Number(count[1] ?? 0)
}
