// The Ticket a branch name carries (CONTEXT.md L1 · Delivery → Ticket, "id-in-branch"): a GitHub
// number written as `#607`, as `argo/#607-slug` does, or a Linear key such as `ENG-12`. Derived
// from the name alone, never asserted, so it needs no owned state and holds for every Harness.
const KEY_IN_BRANCH = /(?:^|[/_-])(#\d+|[A-Z][A-Z0-9]+-\d+)(?=$|[/_-])/

export function ticketKeyInBranch(branch: string | null): string | null {
  if (branch === null) return null
  return KEY_IN_BRANCH.exec(branch)?.[1] ?? null
}
