// The Work Item (CONTEXT.md L1): intent, owned by a provider. Argo stores only the LINK —
// everything below is read-through, cached but never authoritative — and every item carries
// TWO words: the provider's own, verbatim, which is what a human reads (#167 discipline), and
// the canonical bucket, which is the only thing Argo ranks, filters and transitions on. The
// two live in one value object precisely so no surface can reach for one and get the other.

/** The canonical five (#167). `done` (completed) and `closed` (terminated without completing)
 * are deliberately distinct: abandoning and finishing must not read alike. */
export type WorkItemBucket = 'todo' | 'in-progress' | 'in-review' | 'done' | 'closed'

/** How much of the five a provider's own workflow can actually carry. A bare tracker (GitHub
 * Issues) only distinguishes not-started from the two terminal kinds, so `in-progress` and
 * `in-review` are absent rather than synthesized from local facts. */
export type WorkflowTier = 'bare' | 'full'

/** What one `blockedBy` edge is doing, VERIFIED from the blocker itself — never inferred from
 * the provider's summary count, which is stale. `ruled-out` satisfies no edge (CONTEXT.md L1):
 * a cancelled blocker leaves its dependents stranded until a human re-scopes one of the two,
 * which is Argo deliberately disagreeing with the GitHub and Linear UIs. */
export type BlockerState = 'blocking' | 'satisfied' | 'ruled-out' | 'unknown'

/** The role a node plays in the hierarchy — a ROLE, never a stored type. */
export type WorkItemKind = 'prd' | 'task'

export interface WorkItemStatus {
  /** The provider's own status word, exactly as its API spelled it. Never reworded, never
   * title-cased, never replaced by the bucket. */
  word: string
  bucket: WorkItemBucket
}

export interface WorkItemBlocker {
  id: string
  /** What the blocker is called where the user would look it up. */
  reference: string
  state: BlockerState
}

export interface WorkItemView {
  /** Provider-qualified and stable across a rename or a re-title. */
  id: string
  projectId: string
  /** The human-facing handle (`#256`), which is not the id. */
  reference: string
  title: string
  /** Where the item lives at the provider — the honest address, since Argo holds no content. */
  url: string
  status: WorkItemStatus
  kind: WorkItemKind
  /** The provider's declared type word where it carries one, verbatim and `null` otherwise.
   * Kept beside `kind` rather than folded into it: the word is what a ticket shows, the kind
   * is what the tree ranks on, and collapsing them would lose the provider's vocabulary. */
  declaredType: string | null
  parentId: string | null
  blockedBy: WorkItemBlocker[]
  /** Who the provider says holds it, verbatim, and `null` for nobody. Never the claim lease —
   * the assignee is a visible echo for teammates (CONTEXT.md L1), written by the agent. */
  assignee: string | null
  /** The provider's own priority word, verbatim. `null` where the provider carries no priority
   * at all — a fact it cannot establish, not a lowest-priority item. */
  priority: string | null
  labels: string[]
  /** Epoch ms of the provider's own last-updated stamp, `null` when it carried none. */
  updatedAt: number | null
}

const PARENT_TYPE_WORDS = ['prd', 'epic', 'initiative', 'feature', 'milestone', 'project']

/**
 * The role, from the provider's declared type when it has one and from hierarchy only when it
 * does not (CONTEXT.md L1). Reading hierarchy first is what miscasts a childless PRD as a Task,
 * so a declared word always wins — even a declared word Argo does not recognise, which is a leaf
 * role stated by the provider rather than an absence to guess at.
 */
export function workItemKind(declaredType: string | null, hasChildren: boolean): WorkItemKind {
  if (declaredType === null) return hasChildren ? 'prd' : 'task'
  return PARENT_TYPE_WORDS.includes(declaredType.trim().toLowerCase()) ? 'prd' : 'task'
}

/**
 * A `WorkItemView` from just the identity a case is about — the Work-room counterpart to
 * `sessionView`, and the one home for that shape. Defaults are the honest floor of a bare
 * tracker: an open leaf, nothing declared, nothing blocking.
 */
export function workItemView(over: Partial<WorkItemView> & { id: string }): WorkItemView {
  return {
    projectId: 'p-unknown',
    reference: `#${over.id}`,
    title: `Work item ${over.id}`,
    url: '',
    status: { word: 'open', bucket: 'todo' },
    kind: 'task',
    declaredType: null,
    parentId: null,
    blockedBy: [],
    assignee: null,
    priority: null,
    labels: [],
    updatedAt: null,
    ...over,
  }
}
