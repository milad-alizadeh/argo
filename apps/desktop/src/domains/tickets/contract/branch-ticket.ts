// The Ticket a branch name carries (CONTEXT.md L1 · Delivery → Ticket, "id-in-branch"): a GitHub
// number written as `#607`, as `argo/#607-slug` does, or a Linear key such as `ENG-12`. Derived
// from the name alone, never asserted, so it needs no owned state and holds for every CLI.
const KEY_IN_BRANCH = /(?:^|[/_-])(#\d+|[A-Z][A-Z0-9]+-\d+)(?=$|[/_-])/

// Claude Code records `gitBranch: "HEAD"` inside a worktree, so the branch names no Ticket there;
// the worktree folder does, as `hooks.json` `worktreeGuard.dir` shapes it: `ticket-<N>-<slug>`.
// A Session often runs in a folder below it, such as `apps/desktop`, so every segment is read.
const KEY_IN_WORKTREE = /^ticket-(\d+)(?=$|-)/

export function ticketKeyInBranch(branch: string | null): string | null {
  if (branch === null) return null
  return KEY_IN_BRANCH.exec(branch)?.[1] ?? null
}

export function ticketKeyInPlace(branch: string | null, cwd: string | null): string | null {
  const inBranch = ticketKeyInBranch(branch)
  if (inBranch !== null) return inBranch
  const numbers = (cwd ?? '')
    .split('/')
    .flatMap((segment) => KEY_IN_WORKTREE.exec(segment)?.[1] ?? [])
  const number = numbers.at(-1)
  return number === undefined ? null : `#${number}`
}
